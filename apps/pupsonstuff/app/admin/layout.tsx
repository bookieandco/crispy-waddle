import AdminSidebar from "@/components/admin/AdminSidebar";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // Opaque background, not the translucent cream/20 the rest of the app
    // uses elsewhere — globals.css sets body { background: #171716 } (the
    // boutique's dark theme), which a translucent tint here just lets
    // show through underneath, muddying every card's contrast. An admin
    // dashboard wants a clean, fully-opaque light surface regardless of
    // the storefront's mood, so this opts out of that inherited dark
    // backdrop explicitly rather than fighting it with opacity.
    <div className="flex min-h-screen bg-cream">
      <AdminSidebar />
      <main className="flex-1 overflow-x-auto p-6 md:p-8">{children}</main>
    </div>
  );
}
