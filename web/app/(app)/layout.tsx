import { AppSidebar } from "@/components/app-sidebar"
import { AuthProvider } from "@/components/auth-provider"
import { RoleProvider } from "@/components/role-provider"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <RoleProvider>
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset>{children}</SidebarInset>
        </SidebarProvider>
      </RoleProvider>
    </AuthProvider>
  )
}
