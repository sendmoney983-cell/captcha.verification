import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { mainnet } from 'wagmi/chains';

export const config = getDefaultConfig({
  appName: 'Hourglass',
  projectId: 'e567c2ad31ee5e65d8ed972b0b289b76',
  chains: [mainnet],
  ssr: false,
});
