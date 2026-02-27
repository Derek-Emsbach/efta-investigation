'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import MainContent from '@/components/layout/main-content'
import { PageHeader } from '@/components/ui/page-header'
import Link from 'next/link'

interface DatasetOption {
  id: string
  number: number
  name: string | null
}

type FileStatus = 'pending' | 'presigning' | 'uploading' | 'confirming' | 'done' | 'error'

interface UploadFile {
  file: File
  id: string | null
  batesNumber: string | null
  status: FileStatus
  progress: number
  error: string | null
  isReupload: boolean
  reuploadVersion: number | null
}

const MAX_CONCURRENT = 5
const PRESIGN_BATCH_SIZE = 50

export default function UploadPage() {
  const [datasets, setDatasets] = useState<DatasetOption[]>([])
  const [selectedDataset, setSelectedDataset] = useState<string>('')
  const [batesPrefix, setBatesPrefix] = useState('')
  const [files, setFiles] = useState<UploadFile[]>([])
  const [isDragOver, setIsDragOver] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [isScanning, setIsScanning] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  // Fetch datasets for selector
  useEffect(() => {
    fetch('/api/stats')
      .then((r) => r.json())
      .then((data) => {
        if (data.datasets) {
          setDatasets(
            data.datasets.map((d: { id: string; number: number; name: string | null }) => ({
              id: d.id,
              number: d.number,
              name: d.name,
            })),
          )
        }
      })
      .catch(() => {})
  }, [])

  const addFiles = useCallback((newFiles: File[]) => {
    const pdfFiles = newFiles.filter((f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'))
    if (pdfFiles.length === 0) return

    setFiles((prev) => [
      ...prev,
      ...pdfFiles.map((file) => ({
        file,
        id: null,
        batesNumber: null,
        status: 'pending' as FileStatus,
        progress: 0,
        error: null,
        isReupload: false,
        reuploadVersion: null,
      })),
    ])
  }, [])

  // Recursively extract all files from a FileSystemEntry tree
  const scanDirectoryEntry = useCallback(async (entry: FileSystemEntry): Promise<File[]> => {
    if (entry.isFile) {
      return new Promise((resolve) => {
        (entry as FileSystemFileEntry).file((f) => resolve([f]), () => resolve([]))
      })
    }
    if (entry.isDirectory) {
      const dirReader = (entry as FileSystemDirectoryEntry).createReader()
      const files: File[] = []
      // readEntries returns batches of ~100, must call repeatedly until empty
      const readBatch = (): Promise<FileSystemEntry[]> =>
        new Promise((resolve) => dirReader.readEntries(resolve, () => resolve([])))
      let batch = await readBatch()
      while (batch.length > 0) {
        for (const child of batch) {
          const childFiles = await scanDirectoryEntry(child)
          files.push(...childFiles)
        }
        batch = await readBatch()
      }
      return files
    }
    return []
  }, [])

  // Drag and drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)

    const items = Array.from(e.dataTransfer.items)
    const entries = items
      .map((item) => item.webkitGetAsEntry?.())
      .filter((entry): entry is FileSystemEntry => entry != null)

    // If any entries are directories, scan recursively
    const hasDirectories = entries.some((e) => e.isDirectory)
    if (hasDirectories) {
      setIsScanning(true)
      const allFiles: File[] = []
      for (const entry of entries) {
        const found = await scanDirectoryEntry(entry)
        allFiles.push(...found)
      }
      setIsScanning(false)
      addFiles(allFiles)
    } else {
      addFiles(Array.from(e.dataTransfer.files))
    }
  }, [addFiles, scanDirectoryEntry])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addFiles(Array.from(e.target.files))
      e.target.value = ''
    }
  }, [addFiles])

  const handleFolderSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addFiles(Array.from(e.target.files))
      e.target.value = ''
    }
  }, [addFiles])

  const removeFile = useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const clearCompleted = useCallback(() => {
    setFiles((prev) => prev.filter((f) => f.status !== 'done'))
  }, [])

  // Upload a single file via XHR (for progress events)
  const uploadToR2 = (presignedUrl: string, file: File, index: number): Promise<void> => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const pct = Math.round((e.loaded / e.total) * 100)
          setFiles((prev) =>
            prev.map((f, i) => (i === index ? { ...f, progress: pct } : f)),
          )
        }
      })

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve()
        } else {
          reject(new Error(`Upload failed with status ${xhr.status}`))
        }
      })

      xhr.addEventListener('error', () => reject(new Error('Network error during upload')))
      xhr.addEventListener('abort', () => reject(new Error('Upload aborted')))

      xhr.open('PUT', presignedUrl)
      xhr.setRequestHeader('Content-Type', 'application/pdf')
      xhr.send(file)
    })
  }

  const startUpload = async () => {
    const pendingIndices = files
      .map((f, i) => (f.status === 'pending' ? i : -1))
      .filter((i) => i !== -1)
    if (pendingIndices.length === 0) return

    setIsUploading(true)

    try {
      // Mark all pending as presigning
      setFiles((prev) =>
        prev.map((f) =>
          f.status === 'pending' ? { ...f, status: 'presigning' as FileStatus } : f,
        ),
      )

      // Step 1: Get presigned URLs in batches of PRESIGN_BATCH_SIZE
      const allPresigned: Array<{ fileIdx: number; presigned: Record<string, unknown> }> = []

      for (let batchStart = 0; batchStart < pendingIndices.length; batchStart += PRESIGN_BATCH_SIZE) {
        const batchIndices = pendingIndices.slice(batchStart, batchStart + PRESIGN_BATCH_SIZE)

        const presignRes = await fetch('/api/upload/presign', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            files: batchIndices.map((idx) => ({
              filename: files[idx].file.name,
              size_bytes: files[idx].file.size,
              dataset_id: selectedDataset || undefined,
              bates_number: batesPrefix || undefined,
            })),
          }),
        })

        if (!presignRes.ok) {
          const err = await presignRes.json()
          throw new Error(err.error || 'Failed to get presigned URLs')
        }

        const { files: presignedFiles } = await presignRes.json()

        // Update file states for this batch and collect upload targets
        setFiles((prev) =>
          prev.map((f, i) => {
            const batchPos = batchIndices.indexOf(i)
            if (batchPos === -1 || !presignedFiles[batchPos]) return f
            const pf = presignedFiles[batchPos]
            if (pf.skipped || pf.error) {
              return { ...f, status: 'error' as FileStatus, error: pf.error || 'Skipped' }
            }
            return {
              ...f,
              id: pf.id,
              batesNumber: pf.bates_number,
              status: 'uploading' as FileStatus,
              progress: 0,
              isReupload: pf.reupload === true,
              reuploadVersion: pf.new_version ?? null,
            }
          }),
        )

        batchIndices.forEach((fileIdx, batchPos) => {
          const pf = presignedFiles[batchPos]
          if (pf && !pf.skipped && !pf.error) {
            allPresigned.push({ fileIdx, presigned: pf })
          }
        })
      }

      // Step 2: Upload files to R2 in parallel (max concurrent)
      const documentIds: string[] = []

      for (let i = 0; i < allPresigned.length; i += MAX_CONCURRENT) {
        const chunk = allPresigned.slice(i, i + MAX_CONCURRENT)
        await Promise.allSettled(
          chunk.map(async ({ fileIdx, presigned }) => {
            try {
              await uploadToR2(presigned.presigned_url as string, files[fileIdx].file, fileIdx)
              documentIds.push(presigned.id as string)
              setFiles((prev) =>
                prev.map((f, idx) =>
                  idx === fileIdx ? { ...f, status: 'confirming' as FileStatus, progress: 100 } : f,
                ),
              )
            } catch (err) {
              setFiles((prev) =>
                prev.map((f, idx) =>
                  idx === fileIdx
                    ? { ...f, status: 'error' as FileStatus, error: err instanceof Error ? err.message : 'Upload failed' }
                    : f,
                ),
              )
            }
          }),
        )
      }

      // Step 3: Confirm uploads (also in batches)
      for (let i = 0; i < documentIds.length; i += PRESIGN_BATCH_SIZE) {
        const batch = documentIds.slice(i, i + PRESIGN_BATCH_SIZE)
        const confirmRes = await fetch('/api/upload/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ document_ids: batch }),
        })

        if (confirmRes.ok) {
          const { confirmed } = await confirmRes.json()
          setFiles((prev) =>
            prev.map((f) =>
              f.id && batch.includes(f.id) && f.status === 'confirming'
                ? { ...f, status: 'done' as FileStatus }
                : f,
            ),
          )
          console.log(`${confirmed} files confirmed in R2`)
        }
      }
    } catch (err) {
      setFiles((prev) =>
        prev.map((f) =>
          f.status === 'presigning' || f.status === 'uploading'
            ? { ...f, status: 'error' as FileStatus, error: err instanceof Error ? err.message : 'Upload failed' }
            : f,
        ),
      )
    } finally {
      setIsUploading(false)
    }
  }

  const pendingCount = files.filter((f) => f.status === 'pending').length
  const doneCount = files.filter((f) => f.status === 'done').length
  const errorCount = files.filter((f) => f.status === 'error').length
  const activeCount = files.filter((f) =>
    ['presigning', 'uploading', 'confirming'].includes(f.status),
  ).length
  const reuploadCount = files.filter((f) => f.isReupload && f.status === 'done').length
  const newUploadCount = doneCount - reuploadCount

  return (
    <MainContent>
      <PageHeader
        title="Upload Documents"
        subtitle="Upload EFTA PDF documents for processing"
      />

      {/* Configuration row */}
      <div className="flex flex-wrap gap-4 mb-6">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs text-text-muted mb-1">Dataset (optional)</label>
          <select
            value={selectedDataset}
            onChange={(e) => setSelectedDataset(e.target.value)}
            className="w-full bg-elevated border border-border-default rounded-lg px-3 py-2 text-sm text-text-primary focus:border-info focus:outline-none"
          >
            <option value="">No dataset</option>
            {datasets.map((ds) => (
              <option key={ds.id} value={ds.id}>
                DS{ds.number}{ds.name ? ` — ${ds.name}` : ''}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs text-text-muted mb-1">Bates number prefix (optional)</label>
          <input
            type="text"
            value={batesPrefix}
            onChange={(e) => setBatesPrefix(e.target.value)}
            placeholder="e.g. EFTA0273"
            className="w-full bg-elevated border border-border-default rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-info focus:outline-none font-mono"
          />
          <p className="text-xs text-text-muted mt-1">Auto-detected from filename if not set</p>
        </div>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-lg p-6 sm:p-12 text-center transition-all ${
          isDragOver
            ? 'border-info bg-info/5'
            : 'border-border-default hover:border-border-hover hover:bg-elevated/30'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,application/pdf"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />
        <input
          ref={folderInputRef}
          type="file"
          accept=".pdf,application/pdf"
          /* @ts-expect-error webkitdirectory is not in React's type defs */
          webkitdirectory=""
          multiple
          onChange={handleFolderSelect}
          className="hidden"
        />
        {isScanning ? (
          <>
            <svg className="w-12 h-12 mx-auto mb-4 text-info animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 2v4m0 12v4m-7.07-3.93l2.83-2.83m8.48-8.48l2.83-2.83M2 12h4m12 0h4m-3.93 7.07l-2.83-2.83M6.34 6.34L3.51 3.51" />
            </svg>
            <p className="text-text-primary font-medium mb-1">Scanning folders for PDFs...</p>
          </>
        ) : (
          <>
            <svg
              className={`w-12 h-12 mx-auto mb-4 ${isDragOver ? 'text-info' : 'text-text-muted'}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <p className="text-text-primary font-medium mb-1">
              {isDragOver ? 'Drop PDF files or folders here' : 'Drag & drop PDF files or folders here'}
            </p>
            <div className="flex items-center justify-center gap-3 mt-3">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-sm text-info hover:text-info/80 underline transition-colors"
              >
                Select files
              </button>
              <span className="text-text-muted text-sm">or</span>
              <button
                type="button"
                onClick={() => folderInputRef.current?.click()}
                className="text-sm text-info hover:text-info/80 underline transition-colors"
              >
                Select folder
              </button>
            </div>
            <p className="text-xs text-text-muted mt-2">
              Folders are scanned recursively for PDFs. No file size limit.
            </p>
          </>
        )}
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-4 text-sm">
              <span className="text-text-primary font-medium">{files.length} file{files.length !== 1 ? 's' : ''}</span>
              {pendingCount > 0 && <span className="text-text-muted">{pendingCount} pending</span>}
              {activeCount > 0 && <span className="text-info">{activeCount} uploading</span>}
              {doneCount > 0 && <span className="text-success">{doneCount} done</span>}
              {errorCount > 0 && <span className="text-critical">{errorCount} failed</span>}
            </div>
            <div className="flex items-center gap-2">
              {doneCount > 0 && (
                <button
                  onClick={clearCompleted}
                  className="text-xs text-text-muted hover:text-text-secondary transition-colors"
                >
                  Clear completed
                </button>
              )}
              {pendingCount > 0 && (
                <button
                  onClick={startUpload}
                  disabled={isUploading}
                  className="bg-info hover:bg-info/90 disabled:opacity-50 text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors"
                >
                  {isUploading ? 'Uploading...' : `Upload ${pendingCount} file${pendingCount !== 1 ? 's' : ''}`}
                </button>
              )}
            </div>
          </div>

          <div className="border border-border-default rounded-lg overflow-hidden divide-y divide-border-default">
            {files.map((f, i) => (
              <div key={`${f.file.name}-${i}`} className="flex items-center gap-3 px-4 py-3 bg-surface">
                {/* Status icon */}
                <div className="shrink-0">
                  {f.status === 'done' && !f.isReupload && (
                    <svg className="w-5 h-5 text-success" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                  {f.status === 'done' && f.isReupload && (
                    <svg className="w-5 h-5 text-warning" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  )}
                  {f.status === 'error' && (
                    <svg className="w-5 h-5 text-critical" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                  {f.status === 'pending' && (
                    <svg className="w-5 h-5 text-text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                  )}
                  {['presigning', 'uploading', 'confirming'].includes(f.status) && (
                    <svg className="w-5 h-5 text-info animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 2v4m0 12v4m-7.07-3.93l2.83-2.83m8.48-8.48l2.83-2.83M2 12h4m12 0h4m-3.93 7.07l-2.83-2.83M6.34 6.34L3.51 3.51" />
                    </svg>
                  )}
                </div>

                {/* File info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-text-primary truncate">{f.file.name}</p>
                    {f.isReupload && f.reuploadVersion && (
                      <span className="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-warning/15 text-warning border border-warning/25">
                        Re-upload v{f.reuploadVersion}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-text-muted">
                    <span>{formatBytes(f.file.size)}</span>
                    {f.batesNumber && <span className="font-mono">{f.batesNumber}</span>}
                    {f.error && <span className="text-critical">{f.error}</span>}
                    {f.isReupload && f.status === 'uploading' && <span className="text-warning">{f.progress}%</span>}
                    {!f.isReupload && f.status === 'uploading' && <span className="text-info">{f.progress}%</span>}
                    {f.status === 'presigning' && <span className="text-info">Preparing...</span>}
                    {f.status === 'confirming' && <span className="text-info">Confirming...</span>}
                  </div>

                  {/* Progress bar */}
                  {(f.status === 'uploading' || f.status === 'confirming') && (
                    <div className="mt-1.5 h-1 bg-elevated rounded-full overflow-hidden">
                      <div
                        className="h-full bg-info rounded-full transition-all duration-300"
                        style={{ width: `${f.progress}%` }}
                      />
                    </div>
                  )}
                </div>

                {/* Remove button */}
                {(f.status === 'pending' || f.status === 'error') && (
                  <button
                    onClick={() => removeFile(i)}
                    className="shrink-0 text-text-muted hover:text-text-secondary transition-colors"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Post-upload actions */}
          {doneCount > 0 && !isUploading && (
            <div className={`mt-4 p-4 rounded-lg ${
              reuploadCount > 0
                ? 'bg-warning/5 border border-warning/20'
                : 'bg-success/5 border border-success/20'
            }`}>
              <p className="text-sm font-medium mb-2">
                {reuploadCount > 0 ? (
                  <span className="text-text-primary">
                    {newUploadCount > 0 && (
                      <span className="text-success">{newUploadCount} new</span>
                    )}
                    {newUploadCount > 0 && reuploadCount > 0 && ' and '}
                    {reuploadCount > 0 && (
                      <span className="text-warning">{reuploadCount} re-upload{reuploadCount !== 1 ? 's' : ''}</span>
                    )}
                    {' '}queued for processing
                  </span>
                ) : (
                  <span className="text-success">
                    {doneCount} document{doneCount !== 1 ? 's' : ''} uploaded successfully
                  </span>
                )}
              </p>
              {reuploadCount > 0 && (
                <p className="text-xs text-text-muted mb-2">
                  Re-uploaded documents will be compared against previous versions. Check the processing queue for diff results.
                </p>
              )}
              <div className="flex items-center gap-3">
                <Link
                  href="/dashboard/processing"
                  className="text-sm text-info hover:text-info/80 underline transition-colors"
                >
                  View processing queue
                </Link>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Info panel */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-surface border border-border-default rounded-lg p-4">
          <h3 className="text-sm font-medium text-text-primary mb-1">Upload</h3>
          <p className="text-xs text-text-muted">
            Drop files or entire folders — PDFs are found recursively.
            Uploads directly to R2 with no file size limits. 5 concurrent uploads, batched automatically.
          </p>
        </div>
        <div className="bg-surface border border-border-default rounded-lg p-4">
          <h3 className="text-sm font-medium text-text-primary mb-1">Processing</h3>
          <p className="text-xs text-text-muted">
            After upload, files enter the processing queue. The Python worker extracts metadata,
            runs forensic analysis, and extracts text automatically.
          </p>
        </div>
        <div className="bg-surface border border-border-default rounded-lg p-4">
          <h3 className="text-sm font-medium text-text-primary mb-1">Review</h3>
          <p className="text-xs text-text-muted">
            Processed documents appear in the review queue where you can verify extracted data,
            assign classifications, and approve for publication.
          </p>
        </div>
      </div>
    </MainContent>
  )
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}
