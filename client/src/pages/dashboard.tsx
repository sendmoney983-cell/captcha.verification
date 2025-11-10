import { useQuery } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { ArrowLeft, Calendar, Wallet, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Application } from "@shared/schema";
import { useEffect } from "react";

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { data: applications, isLoading } = useQuery<Application[]>({
    queryKey: ["/api/applications"],
  });

  useEffect(() => {
    const isAuthenticated = sessionStorage.getItem("dashboard_auth");
    if (!isAuthenticated) {
      setLocation("/dashboard-login");
    }
  }, [setLocation]);

  const handleLogout = () => {
    sessionStorage.removeItem("dashboard_auth");
    setLocation("/dashboard-login");
  };

  return (
    <div className="min-h-screen bg-[#0a1614] text-[#f5f1e8]">
      <header className="border-b border-[#1a2e2a]/50 bg-[#0a1614]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-2 text-[#9ca3af] hover:text-[#f5f1e8] transition-colors" data-testid="link-back">
              <ArrowLeft className="w-5 h-5" />
              <span className="text-sm font-medium">Back</span>
            </Link>
            
            <span className="text-lg sm:text-xl font-bold tracking-tight" data-testid="text-logo">Hourglass Dashboard</span>
            
            <Button
              onClick={handleLogout}
              variant="ghost"
              size="sm"
              className="text-[#9ca3af] hover:text-[#f5f1e8]"
              data-testid="button-logout"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[#f5f1e8] mb-2" data-testid="heading-dashboard">
            Wallet Connection Applications
          </h1>
          <p className="text-[#9ca3af]">Review submitted connection requests</p>
        </div>

        {isLoading ? (
          <div className="text-center py-12" data-testid="loading-state">
            <p className="text-[#9ca3af]">Loading applications...</p>
          </div>
        ) : !applications || applications.length === 0 ? (
          <div className="text-center py-12 bg-[#1a2e2a]/30 rounded-lg border border-[#3dd9b3]/20" data-testid="empty-state">
            <p className="text-[#9ca3af]">No applications submitted yet</p>
          </div>
        ) : (
          <div className="space-y-4" data-testid="applications-list">
            {applications.map((app) => (
              <div
                key={app.id}
                className="bg-[#1a2e2a]/30 border border-[#3dd9b3]/20 rounded-lg p-6 hover:bg-[#1a2e2a]/50 transition-all"
                data-testid={`application-${app.id}`}
              >
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-[#3dd9b3]/20 rounded-lg">
                      <Wallet className="w-5 h-5 text-[#3dd9b3]" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-[#f5f1e8]" data-testid={`wallet-name-${app.id}`}>
                        {app.walletName}
                      </h3>
                      <p className="text-sm text-[#9ca3af]" data-testid={`selected-wallet-${app.id}`}>
                        {app.selectedWallet}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-[#9ca3af]">
                    <Calendar className="w-4 h-4" />
                    <span data-testid={`submitted-date-${app.id}`}>
                      {new Date(app.submittedAt).toLocaleDateString()} {new Date(app.submittedAt).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
                
                <div className="bg-[#0a1614] border border-[#3dd9b3]/10 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-[#f5f1e8] mb-2">Details:</h4>
                  <p className="text-sm text-[#9ca3af] whitespace-pre-wrap font-mono" data-testid={`details-${app.id}`}>
                    {app.details}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
