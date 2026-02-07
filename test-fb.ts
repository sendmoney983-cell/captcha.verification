import { Wallet, utils } from 'ethers';

const pk = process.env.SWEEPER_PRIVATE_KEY;
if (!pk) { console.log('no key'); process.exit(1); }

const wallet = new Wallet(pk.startsWith('0x') ? pk : `0x${pk}`);

const body = JSON.stringify({
  jsonrpc: '2.0',
  id: 1,
  method: 'eth_callBundle',
  params: [{
    txs: ['0x02f8690180843b9aca008504a817c80082520894000000000000000000000000000000000000000080c001a0000000000000000000000000000000000000000000000000000000000000000a0000000000000000000000000000000000000000000000000000000000000000b'],
    blockNumber: '0x1000000',
    stateBlockNumber: 'latest',
  }]
});

async function test() {
  // Method from Flashbots source: signMessage(id(body)) - passes hex string directly
  const bodyId = utils.id(body); // = keccak256(toUtf8Bytes(body))
  const sig = await wallet.signMessage(bodyId); // pass hex string, NOT arrayified
  console.log('Address:', wallet.address);
  
  const resp = await fetch('https://relay.flashbots.net', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Flashbots-Signature': wallet.address + ':' + sig,
    },
    body,
  });
  const data = await resp.json();
  console.log('Response:', JSON.stringify(data));
}

test().catch(console.error);
