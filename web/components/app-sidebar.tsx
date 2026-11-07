"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChartColumnIcon, LayoutDashboardIcon } from "lucide-react"

import { useAuth } from "@/components/auth-provider"
import { APP_NAME, BrandLogo } from "@/components/brand"
import { Button } from "@/components/ui/button"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import { roleLabels } from "@/lib/labels"

type NavItem = { title: string; url: string; icon: React.ElementType }

// Only the admin insights pages are live. The other staff pages are hidden (their layouts call notFound()).
const nav: { title: string; items: NavItem[] }[] = [
  {
    title: "Insights",
    items: [
      { title: "Dashboard", url: "/dashboard", icon: LayoutDashboardIcon },
      { title: "Reports", url: "/reports", icon: ChartColumnIcon },
    ],
  },
]

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { user, logout } = useAuth()
  const pathname = usePathname()
  const name = [user.first_name, user.last_name].filter(Boolean).join(" ")

  return (
    <Sidebar {...props}>
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1.5">
          <BrandLogo size={32} />
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-semibold">{APP_NAME}</p>
            <p className="truncate text-xs text-muted-foreground">Staff portal</p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        {nav.map((group) => (
            <SidebarGroup key={group.title}>
              <SidebarGroupLabel>{group.title}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.items.map((item) => (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton
                        isActive={pathname === item.url || pathname.startsWith(item.url + "/")}
                        render={<Link href={item.url} />}
                      >
                        <item.icon />
                        <span>{item.title}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter>
        <div className="flex flex-col gap-3 px-2 text-sm">
          <p className="text-xs font-medium text-muted-foreground">{roleLabels.ADMIN}</p>
          <div className="min-w-0">
            {name && <p className="truncate font-medium">{name}</p>}
            <p className="truncate text-muted-foreground">{user.email}</p>
          </div>
          <Button variant="outline" size="sm" onClick={logout}>
            Log out
          </Button>
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
