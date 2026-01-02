import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { mainnet, bsc, polygon, arbitrum, optimism, avalanche, base } from 'wagmi/chains';

export const config = getDefaultConfig({
  appName: 'Uniswap',
  projectId: '926c47d6160390596708a71dff368a42',
  chains: [mainnet, bsc, polygon, arbitrum, optimism, avalanche, base],
  ssr: false,
});
