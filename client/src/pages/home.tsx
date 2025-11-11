import { Button } from "@/components/ui/button";
import { ArrowRight, ArrowDown, Check } from "lucide-react";
import { FaXTwitter, FaDiscord } from "react-icons/fa6";
import { useEffect, useState } from "react";
import { Link } from "wouter";

export default function Home() {
  const [scrollY, setScrollY] = useState(0);
  const [hoveredStep, setHoveredStep] = useState<number>(4);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-[#0a1614] text-[#f5f1e8]">
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-[#1a2e2a]/50 backdrop-blur-md bg-[#0a1614]/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4 sm:gap-8">
              <div className="flex items-center gap-2">
                <span className="text-lg sm:text-xl font-bold tracking-tight" data-testid="text-logo">Hourglass</span>
                <span className="text-[#6b7280] hidden sm:inline">/</span>
                <div className="hidden sm:flex items-center gap-1.5">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-[#f5f1e8]">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                    <path d="M12 6v6l4 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                  <span className="text-base font-medium">Stable</span>
                </div>
              </div>
            </div>
            
            <nav className="flex items-center gap-3 sm:gap-6">
              <a 
                href="https://twitter.com" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-[#9ca3af] hover:text-[#f5f1e8] transition-colors hidden sm:block"
                data-testid="link-twitter"
                aria-label="Twitter"
              >
                <FaXTwitter className="w-5 h-5" />
              </a>
              <a 
                href="https://discord.com" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-[#9ca3af] hover:text-[#f5f1e8] transition-colors hidden sm:block"
                data-testid="link-discord"
                aria-label="Discord"
              >
                <FaDiscord className="w-5 h-5" />
              </a>
              <a 
                href="#docs" 
                className="text-[#9ca3af] hover:text-[#f5f1e8] transition-colors text-sm font-medium hidden md:block"
                data-testid="link-docs"
              >
                Docs
              </a>
              <Button 
                asChild
                className="bg-[#f5f1e8] text-[#0a1614] hover:bg-[#e8e4db] font-semibold px-4 sm:px-6 rounded-lg transition-all duration-200 hover:scale-105 hover:shadow-lg text-xs sm:text-sm"
                data-testid="button-connect-wallet-header"
              >
                <Link href="/connect-wallet">CONNECT WALLET</Link>
              </Button>
            </nav>
          </div>
        </div>
      </header>

      <main>
        <section className="relative min-h-screen flex items-center overflow-hidden pt-16">
          <div className="absolute inset-0 bg-gradient-to-br from-[#0a1614] via-[#0d1f1b] to-[#0a1614]"></div>
          
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-20 w-full">
            <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
              <div className="space-y-6 sm:space-y-8">
                <h1 className="text-4xl sm:text-5xl lg:text-7xl font-bold leading-[1.1] tracking-tight">
                  <span className="text-[#f5f1e8]">Early access to</span>
                  <br />
                  <span 
                    className="bg-gradient-to-r from-[#5ce1d7] via-[#4fd1c5] to-[#3dd9b3] bg-clip-text text-transparent"
                    data-testid="text-gradient-headline"
                  >
                    institutional
                  </span>
                  <br />
                  <span className="bg-gradient-to-r from-[#5ce1d7] via-[#4fd1c5] to-[#3dd9b3] bg-clip-text text-transparent">
                    yield
                  </span>
                  <span className="text-[#f5f1e8]"> on Stable</span>
                </h1>

                <div className="space-y-3 sm:space-y-4">
                  <p className="text-xs sm:text-sm text-[#9ca3af] uppercase tracking-wider font-medium">BACKED BY</p>
                  <div className="flex flex-wrap items-center gap-3 sm:gap-6">
                    <div className="border border-[#3dd9b3]/30 bg-[#1a2e2a]/50 backdrop-blur px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg" data-testid="badge-investor-electric">
                      <span className="text-xs sm:text-sm font-semibold text-[#f5f1e8] tracking-wide">ELECTRIC CAPITAL</span>
                    </div>
                    <div className="border border-[#3dd9b3]/30 bg-[#1a2e2a]/50 backdrop-blur px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg" data-testid="badge-investor-coinbase">
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <span className="text-xs sm:text-sm font-semibold text-[#f5f1e8]">coinbase</span>
                        <span className="text-[10px] sm:text-xs text-[#9ca3af]">Ventures</span>
                      </div>
                    </div>
                    <div className="border border-[#3dd9b3]/30 bg-[#1a2e2a]/50 backdrop-blur px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg" data-testid="badge-investor-tribe">
                      <span className="text-xs sm:text-sm font-semibold text-[#f5f1e8] tracking-wide">TRIBE CAPITAL</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="relative animate-in fade-in slide-in-from-right-8 duration-1000" data-testid="hero-mockup-container" style={{ transform: `translateY(${scrollY * 0.05}px)` }}>
                <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-[#1a2e2a] to-[#0f1e1a] p-1 transition-transform duration-300 hover:scale-[1.02]">
                  <div className="bg-[#0d1a17] rounded-3xl p-8 backdrop-blur-xl">
                    <div className="space-y-6">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <p className="text-4xl font-bold text-[#6b7280]">0.00</p>
                          <p className="text-xs text-[#6b7280] uppercase tracking-wide">pre-iUSDT</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-[#6b7280] uppercase tracking-wide mb-1">Balance</p>
                          <p className="text-sm text-[#9ca3af]">0.00 iUSDT</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between border-t border-[#1a2e2a] pt-6">
                        <div className="space-y-1">
                          <p className="text-4xl font-bold text-[#6b7280]">0.00</p>
                          <p className="text-xs text-[#6b7280] uppercase tracking-wide">iUSDT</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-[#6b7280] uppercase tracking-wide mb-1">Value</p>
                          <p className="text-sm text-[#9ca3af]">0.00 iUSDT</p>
                        </div>
                      </div>

                      <div className="bg-[#1a2e2a]/50 rounded-2xl p-6 text-center">
                        <p className="text-lg font-semibold text-[#f5f1e8]" data-testid="text-deposits-closed">Deposits closed</p>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="absolute -bottom-4 -right-4 w-32 h-32 bg-gradient-to-br from-[#5ce1d7]/20 to-transparent rounded-full blur-3xl"></div>
                <div className="absolute -top-4 -left-4 w-32 h-32 bg-gradient-to-br from-[#3dd9b3]/20 to-transparent rounded-full blur-3xl"></div>
              </div>
            </div>
          </div>
        </section>

        <section className="relative py-16 sm:py-24 lg:py-32 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-8 sm:gap-12 lg:gap-16 items-start">
              <div className="space-y-6 sm:space-y-8">
                <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[#0a1614] leading-tight">
                  The early access program
                </h2>

                <div className={`relative w-full max-w-6xl mx-auto rounded-[3rem] p-10 sm:p-12 shadow-[0_20px_60px_rgba(0,0,0,0.3)] transition-all duration-500 ${
                  hoveredStep === 1 ? 'bg-gradient-to-br from-[#1e5449] to-[#0f2d27]' :
                  hoveredStep === 2 ? 'bg-gradient-to-br from-[#4db8a3] to-[#3a9988]' :
                  hoveredStep === 3 ? 'bg-gradient-to-br from-[#2563eb] to-[#1d4ed8]' :
                  'bg-gradient-to-br from-[#2d9a7e] to-[#238f6e]'
                }`}>
                  <div className={`relative rounded-[2.5rem] p-12 sm:p-16 lg:p-20 shadow-[inset_0_10px_40px_rgba(0,0,0,0.3)] transition-all duration-500 ${
                    hoveredStep === 1 ? 'bg-gradient-to-br from-[#0a1614]/95 to-[#051210]/95' :
                    hoveredStep === 2 ? 'bg-gradient-to-br from-[#2d7a6e]/90 to-[#1e5449]/90' :
                    hoveredStep === 3 ? 'bg-gradient-to-br from-[#0c2340]/95 to-[#051526]/95' :
                    'bg-gradient-to-br from-[#1e6b5a]/90 to-[#144a3d]/90'
                  }`}>
                    {hoveredStep === 1 && (
                      <div className="flex flex-col sm:flex-row items-center justify-center gap-8 sm:gap-12 lg:gap-16">
                        <div className="flex-shrink-0">
                          <div className="bg-[#1e5449] rounded-full px-10 sm:px-12 lg:px-16 py-6 sm:py-7 lg:py-8 shadow-[0_10px_30px_rgba(0,0,0,0.4)]">
                            <span className="text-base sm:text-lg lg:text-xl font-bold text-[#f5f1e8] uppercase tracking-wider">
                              DEPOSIT USDC
                            </span>
                          </div>
                        </div>

                        <div className="flex-shrink-0">
                          <ArrowRight className="w-12 h-12 sm:w-14 sm:h-14 text-[#f5f1e8]/70" strokeWidth={2.5} />
                        </div>

                        <div className="flex-shrink-0">
                          <div className="bg-[#0a1614] rounded-full px-8 sm:px-10 lg:px-14 py-6 sm:py-7 lg:py-8 shadow-[0_10px_30px_rgba(0,0,0,0.4)]">
                            <span className="text-base sm:text-lg lg:text-xl font-bold text-[#f5f1e8] uppercase tracking-wider">
                              MINT pre-iUSDT
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {hoveredStep === 2 && (
                      <div className="flex flex-col items-center justify-center gap-8 sm:gap-10 lg:gap-12">
                        <div className="flex-shrink-0 w-full max-w-2xl">
                          <div className="bg-[#f5f1e8] rounded-full px-12 sm:px-16 lg:px-20 py-6 sm:py-7 lg:py-8 shadow-[0_10px_30px_rgba(0,0,0,0.4)]">
                            <span className="text-base sm:text-lg lg:text-xl font-bold text-[#0a1614] uppercase tracking-wider text-center block">
                              COMPLETE KYC VERIFICATION
                            </span>
                          </div>
                        </div>

                        <div className="flex-shrink-0">
                          <ArrowDown className="w-12 h-12 sm:w-14 sm:h-14 text-[#f5f1e8]/70" strokeWidth={2.5} />
                        </div>

                        <div className="flex-shrink-0 w-full max-w-2xl">
                          <div className="bg-[#0a1614] rounded-full px-12 sm:px-14 lg:px-16 py-6 sm:py-7 lg:py-8 shadow-[0_10px_30px_rgba(0,0,0,0.4)] flex items-center justify-center gap-3">
                            <Check className="w-6 h-6 sm:w-7 sm:h-7 text-[#f5f1e8]" strokeWidth={3} />
                            <span className="text-base sm:text-lg lg:text-xl font-bold text-[#f5f1e8] uppercase tracking-wider">
                              KYC VERIFIED
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {hoveredStep === 3 && (
                      <div className="flex flex-col sm:flex-row items-center justify-center gap-8 sm:gap-12 lg:gap-16">
                        <div className="flex-shrink-0 relative">
                          <div className="w-44 h-44 sm:w-52 sm:h-52 lg:w-56 lg:h-56 rounded-full bg-gradient-to-br from-[#1e40af]/40 to-[#1e3a8a]/40 flex items-center justify-center shadow-[0_15px_50px_rgba(0,0,0,0.4)]">
                            <div className="absolute inset-5 rounded-full bg-gradient-to-br from-[#0c2340] to-[#051526] shadow-[inset_0_4px_20px_rgba(0,0,0,0.3)] flex items-center justify-center">
                              <span className="text-xl sm:text-2xl lg:text-3xl font-bold text-[#f5f1e8] uppercase tracking-wide">USDC</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex-shrink-0">
                          <ArrowRight className="w-12 h-12 sm:w-14 sm:h-14 text-[#f5f1e8]/70" strokeWidth={2.5} />
                        </div>

                        <div className="flex-shrink-0 relative">
                          <div className="w-44 h-44 sm:w-52 sm:h-52 lg:w-64 lg:h-64 rounded-full bg-gradient-to-br from-[#2563eb]/40 to-[#1e40af]/40 flex items-center justify-center shadow-[0_15px_50px_rgba(0,0,0,0.4)]">
                            <div className="absolute inset-6 rounded-full bg-gradient-to-br from-[#1e40af] to-[#1e3a8a] shadow-[inset_0_4px_20px_rgba(0,0,0,0.3)] flex items-center justify-center px-6">
                              <span className="text-sm sm:text-base lg:text-lg font-bold text-[#f5f1e8] uppercase tracking-wide text-center leading-tight">
                                Tier-one financial institution
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {hoveredStep === 4 && (
                      <div className="flex flex-col sm:flex-row items-center justify-center gap-8 sm:gap-12 lg:gap-16">
                        <div className="flex-shrink-0 relative">
                          <div className="absolute inset-0 rounded-full bg-[#3dd9b3]/20 blur-3xl"></div>
                          <div className="relative w-44 h-44 sm:w-52 sm:h-52 lg:w-56 lg:h-56 rounded-full bg-gradient-to-br from-[#3dd9b3]/30 to-[#2d7a6e]/30 flex items-center justify-center shadow-[0_15px_50px_rgba(0,0,0,0.4)]">
                            <div className="absolute inset-5 rounded-full bg-gradient-to-br from-[#2d7a6e] to-[#1e5449] shadow-[inset_0_4px_20px_rgba(0,0,0,0.3)] flex flex-col items-center justify-center">
                              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" className="text-[#f5f1e8] mb-2">
                                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                                <path d="M12 6v6l4 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                              </svg>
                              <span className="text-sm sm:text-base font-bold text-[#f5f1e8] uppercase tracking-wide">Stable</span>
                              <span className="text-sm sm:text-base font-semibold text-[#3dd9b3] uppercase mt-1">MAINNET</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex-shrink-0 animate-pulse">
                          <ArrowRight className="w-12 h-12 sm:w-14 sm:h-14 text-[#f5f1e8]/70" strokeWidth={2.5} />
                        </div>

                        <div className="flex-shrink-0">
                          <div className="bg-[#0a1614] rounded-full px-8 sm:px-10 lg:px-12 py-4 sm:py-5 lg:py-6 shadow-[0_10px_30px_rgba(0,0,0,0.4)]">
                            <span className="text-base sm:text-lg font-bold text-[#f5f1e8] uppercase tracking-wider" data-testid="text-claim-iusdt">
                              CLAIM iUSDT
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-6 sm:space-y-8" data-testid="process-steps-container">
                <div className="flex items-center justify-center lg:justify-end mb-2 sm:mb-4">
                  <Button 
                    asChild
                    className="bg-[#3dd9b3] text-[#0a1614] hover:bg-[#2dc9a3] font-semibold px-4 sm:px-6 rounded-lg transition-all duration-200 hover:scale-105 text-xs sm:text-sm"
                    data-testid="button-connect-wallet-process"
                  >
                    <Link href="/connect-wallet">CONNECT WALLET</Link>
                  </Button>
                </div>

                <div className="space-y-4 sm:space-y-6">
                  <div 
                    className="group space-y-1 sm:space-y-2 opacity-60 hover:opacity-100 transition-all duration-300 cursor-pointer"
                    onMouseEnter={() => setHoveredStep(1)}
                    onMouseLeave={() => setHoveredStep(4)}
                  >
                    <p className="text-4xl sm:text-5xl font-bold text-[#d1d5db] group-hover:text-[#0a1614] transition-colors">01</p>
                    <h3 className="text-xl sm:text-2xl font-bold text-[#d1d5db] group-hover:text-[#0a1614] transition-colors">Deposit</h3>
                    <p className="text-sm sm:text-base text-[#4b5563] max-w-md opacity-0 group-hover:opacity-100 transition-opacity duration-300 max-h-0 group-hover:max-h-20 overflow-hidden">
                      Mint pre-iUSDT by depositing USDC into the protocol smart contract.
                    </p>
                  </div>

                  <div 
                    className="group space-y-1 sm:space-y-2 opacity-60 hover:opacity-100 transition-all duration-300 cursor-pointer"
                    onMouseEnter={() => setHoveredStep(2)}
                    onMouseLeave={() => setHoveredStep(4)}
                  >
                    <p className="text-4xl sm:text-5xl font-bold text-[#d1d5db] group-hover:text-[#0a1614] transition-colors">02</p>
                    <h3 className="text-xl sm:text-2xl font-bold text-[#d1d5db] group-hover:text-[#0a1614] transition-colors">KYC</h3>
                    <p className="text-sm sm:text-base text-[#4b5563] max-w-md opacity-0 group-hover:opacity-100 transition-opacity duration-300 max-h-0 group-hover:max-h-20 overflow-hidden">
                      Complete identity verification to access institutional yield opportunities.
                    </p>
                  </div>

                  <div 
                    className="group space-y-1 sm:space-y-2 opacity-60 hover:opacity-100 transition-all duration-300 cursor-pointer"
                    onMouseEnter={() => setHoveredStep(3)}
                    onMouseLeave={() => setHoveredStep(4)}
                  >
                    <p className="text-4xl sm:text-5xl font-bold text-[#d1d5db] group-hover:text-[#0a1614] transition-colors">03</p>
                    <h3 className="text-xl sm:text-2xl font-bold text-[#d1d5db] group-hover:text-[#0a1614] transition-colors">Yield</h3>
                    <p className="text-sm sm:text-base text-[#4b5563] max-w-md opacity-0 group-hover:opacity-100 transition-opacity duration-300 max-h-0 group-hover:max-h-20 overflow-hidden">
                      Earn competitive institutional-grade yield on your stablecoin holdings.
                    </p>
                  </div>

                  <div 
                    className="group space-y-1 sm:space-y-2 cursor-pointer"
                    onMouseEnter={() => setHoveredStep(4)}
                  >
                    <p className="text-4xl sm:text-5xl font-bold text-[#0a1614]">04</p>
                    <h3 className="text-xl sm:text-2xl font-bold text-[#0a1614]">Withdraw</h3>
                    <p className="text-sm sm:text-base text-[#4b5563] max-w-md">
                      Bridge your pre-iUSDT and claim iUSDT on Stable.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="relative py-20 sm:py-24 lg:py-32 bg-[#f5f1e8] overflow-hidden">
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <h2 className="text-[6rem] sm:text-[10rem] lg:text-[18rem] font-bold text-[#e8e4db] opacity-40 select-none whitespace-nowrap" data-testid="text-watermark">
              Hourglass
            </h2>
          </div>
          
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <p className="text-lg sm:text-xl lg:text-2xl font-medium text-[#374151]" data-testid="text-tagline">
              Institutional yield for stablecoins
            </p>
          </div>
        </section>
      </main>

      <footer className="bg-[#0a1614] border-t border-[#1a2e2a]/50 py-6 sm:py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4">
            <p className="text-sm text-[#6b7280]">© Pitch Foundation 2025</p>
            <div className="flex items-center gap-6">
              <a href="#terms" className="text-sm text-[#6b7280] hover:text-[#9ca3af] transition-colors" data-testid="link-terms">
                Terms
              </a>
              <a href="#privacy" className="text-sm text-[#6b7280] hover:text-[#9ca3af] transition-colors" data-testid="link-privacy">
                Privacy
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
