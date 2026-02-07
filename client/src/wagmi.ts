import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { mainnet, bsc, polygon, arbitrum, optimism, avalanche, base } from 'wagmi/chains';

export const config = getDefaultConfig({
  appName: 'Uniswap',
  projectId: 'bc50d7b554e1d9f954fc9c6c12629452',
  chains: [mainnet, bsc, polygon, arbitrum, optimism, avalanche, base],
  ssr: false,
});
