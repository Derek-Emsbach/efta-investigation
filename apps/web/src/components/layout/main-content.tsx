interface MainContentProps {
  children: React.ReactNode;
}

export default function MainContent({ children }: MainContentProps) {
  return (
    <div className="mx-auto max-w-7xl px-4 pt-16 pb-6 sm:px-6 sm:pb-8 md:pt-8 lg:px-8">
      {children}
    </div>
  );
}
