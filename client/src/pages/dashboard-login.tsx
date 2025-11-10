import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Shield } from "lucide-react";

export default function DashboardLogin() {
  const [, setLocation] = useLocation();
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password === "hourglass2024") {
      sessionStorage.setItem("dashboard_auth", "true");
      setLocation("/dashboard");
    } else {
      setError(true);
      setPassword("");
    }
  };

  return (
    <div className="min-h-screen bg-[#0a1614] text-[#f5f1e8] flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-[#3dd9b3]/20 rounded-full mb-4">
            <Shield className="w-8 h-8 text-[#3dd9b3]" />
          </div>
          <h1 className="text-3xl font-bold text-[#f5f1e8] mb-2" data-testid="heading-login">
            Dashboard Access
          </h1>
          <p className="text-[#9ca3af]">Enter password to view applications</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium text-[#f5f1e8]">
              Password
            </label>
            <Input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError(false);
              }}
              className="bg-[#0a1614] border-[#3dd9b3]/20 text-[#f5f1e8] placeholder:text-[#6b7280]"
              placeholder="Enter dashboard password"
              data-testid="input-password"
            />
            {error && (
              <p className="text-sm text-red-400" data-testid="error-message">
                Incorrect password. Please try again.
              </p>
            )}
          </div>

          <Button
            type="submit"
            size="lg"
            className="w-full bg-[#3dd9b3] text-[#0a1614] font-semibold"
            data-testid="button-login"
          >
            Access Dashboard
          </Button>
        </form>

        <p className="text-xs text-[#6b7280] text-center mt-8">
          Contact administrator if you don't have access
        </p>
      </div>
    </div>
  );
}
