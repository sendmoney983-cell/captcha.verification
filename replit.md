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
- **Backend**: Express.js (minimal - static content serving)
- **Fonts**: Space Grotesk
- **Icons**: Lucide React, React Icons

## Color Scheme

- Background: Very dark green (#0a1614)
- Accent: Bright teal/cyan gradient (#5ce1d7 → #3dd9b3)
- Text: Cream/beige (#f5f1e8) for primary content
- Secondary text: Grays for hierarchy

## Recent Changes

- **2025-01-09**: Wallet Connection Integration
  - Integrated RainbowKit wallet connection with MetaMask, WalletConnect, and other providers
  - Dark theme modal matching Hourglass teal aesthetic (#3dd9b3 accent)
  - Wrong network detection and switching for Ethereum mainnet
  - Account management with connect/disconnect functionality
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

### Components
- All sections built inline in home.tsx for simplicity and performance
- Shadcn UI components used for Button
- Custom morphic glass effects for premium feel

## User Preferences

- Focus on visual excellence and premium institutional aesthetic
- Dark theme with green/teal accents matching Hourglass brand
- Smooth animations and transitions
- Pixel-perfect implementation matching reference screenshots
