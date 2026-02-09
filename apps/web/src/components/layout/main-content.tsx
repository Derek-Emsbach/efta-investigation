interface MainContentProps {
  children: React.ReactNode;
}

export default function MainContent({ children }: MainContentProps) {
  return (
    <div className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
      {children}
    </div>
  );
}
