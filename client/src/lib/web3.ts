import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { mainnet } from 'wagmi/chains';

const projectId = 'e567c2ad31ee5e65d8ed972b0b289b76';

if (!projectId) {
  throw new Error('VITE_WALLETCONNECT_PROJECT_ID is not configured');
}

export const config = getDefaultConfig({
  appName: 'Hourglass',
  projectId,
  chains: [mainnet],
  ssr: false,
});
