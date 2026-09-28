export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen">
      {/* TODO (T-06): Sidebar */}
      <main className="flex-1 overflow-auto">{children}</main>
      {/* TODO (T-11): Task panel host */}
    </div>
  );
}
