# Hourglass - Institutional Yield Platform

A stunning crypto landing page for Hourglass, featuring institutional yield for stablecoins.

## Project Overview

This is a premium landing page showcasing the Hourglass early access program for institutional yield on Stable. The design features a dark green/teal aesthetic with sophisticated animations and a professional institutional feel.

## Key Features

- **Hero Section**: Bold headline with gradient "institutional yield" text, backed by Electric Capital, Coinbase Ventures, and Tribe Capital
- **Animated Mockup**: Interactive deposit interface showing platform UI
- **Early Access Program**: Green morphic UI component with Stable MAINNET → CLAIM iUSDT flow
- **Process Steps**: Four-step program visualization (Deposit, KYC, Yield, Withdraw)
- **Wallet Connection**: Fully functional wallet integration using RainbowKit
  - Supports MetaMask, WalletConnect, Coinbase Wallet, Rainbow, and other popular wallets
  - Professional modal popup with dark theme matching Hourglass aesthetic
  - Wrong network detection - prompts users to switch to Ethereum mainnet
  - Shows connected wallet address with account management options
- **Footer**: Large "Hourglass" watermark with institutional tagline

## Tech Stack

- **Frontend**: React, TypeScript, Tailwind CSS, Shadcn UI
- **Web3**: wagmi, viem, RainbowKit for wallet connectivity
- **Backend**: Express.js, Discord.js for ticketing bot
- **Database**: PostgreSQL (Neon) with Drizzle ORM
- **Discord Bot**: Fully integrated ticketing system
- **Fonts**: Space Grotesk
- **Icons**: Lucide React, React Icons

## Color Scheme

- Background: Very dark green (#0a1614)
- Accent: Bright teal/cyan gradient (#5ce1d7 → #3dd9b3)
- Text: Cream/beige (#f5f1e8) for primary content
- Secondary text: Grays for hierarchy

## Recent Changes

- **2025-11-18**: Discord Ticketing System - FULLY OPERATIONAL ✅
  - Integrated Discord.js bot with full ticketing functionality
  - `/panel` slash command to deploy ticket panel in any channel
  - Three ticket categories: General Support, Bug Report, Partnership Request
  - Ticket features: create, claim, close with database persistence
  - Web dashboard at /tickets to view all tickets and conversations
  - API routes for ticket management and message history
  - PostgreSQL database with tickets and ticket_messages tables
  - Automatic ticket counter syncing from database
  - Discord bot successfully connected (Support system#5269)
  - All interactions working without timeout errors
  
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
- Dark theme with green/teal accents matching Hourglass brand
- Smooth animations and transitions
- Pixel-perfect implementation matching reference screenshots
