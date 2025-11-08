import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { AlertCircle, LayoutDashboard, FileText, Shield, LogOut } from "lucide-react";

export function Navigation() {
  const { role, signOut } = useAuth();

  return (
    <nav className="border-b border-border bg-card">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link to="/dashboard" className="flex items-center gap-2">
          <AlertCircle className="h-6 w-6 text-primary" />
          <span className="text-xl font-bold">Smart Alert</span>
        </Link>
        <div className="flex items-center gap-4">
          <Link to="/dashboard">
            <Button variant="ghost" size="sm">
              <LayoutDashboard className="mr-2 h-4 w-4" />
              Dashboard
            </Button>
          </Link>
          {role === "USER" && (
            <Link to="/submit-report">
              <Button variant="ghost" size="sm">
                <FileText className="mr-2 h-4 w-4" />
                Submit Report
              </Button>
            </Link>
          )}
          {role === "MODERATOR" && (
            <Link to="/moderate">
              <Button variant="ghost" size="sm">
                <Shield className="mr-2 h-4 w-4" />
                Moderate
              </Button>
            </Link>
          )}
          <Button variant="ghost" size="sm" onClick={signOut}>
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </div>
    </nav>
  );
}
