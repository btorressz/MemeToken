import BN from "bn.js";
import * as web3 from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
// Client
//TODO: REVIEW 
import * as dotenv from 'dotenv';
import * as web3 from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import { Program, AnchorProvider, Wallet } from '@coral-xyz/anchor';
import { MemeToken } from '../target/types/memetoken';
import type { Memetoken } from "../target/types/memetoken";

// Configure the client to use the local cluster
anchor.setProvider(anchor.AnchorProvider.env());

const program = anchor.workspace.Memetoken as anchor.Program<Memetoken>;


dotenv.config();

const main = async () => {
  // Set up the provider
  const connection = new web3.Connection(web3.clusterApiUrl('devnet'), 'confirmed');
  const wallet = anchor.Wallet.local(); // Assumes your wallet is set up locally
  const provider = new AnchorProvider(connection, wallet, AnchorProvider.defaultOptions());
  anchor.setProvider(provider);

  // Load the program ID from the environment variable
  const programId = new web3.PublicKey(process.env.PROGRAM_ID!);
  const idl = JSON.parse(require('fs').readFileSync('../target/idl/memetoken.json', 'utf8'));
  const program = new anchor.Program(idl, programId) as Program<MemeToken>;

  // Fetch and display wallet balance
  console.log('My address:', wallet.publicKey.toString());
  const balance = await connection.getBalance(wallet.publicKey);
  console.log(`My balance: ${balance / web3.LAMPORTS_PER_SOL} SOL`);

  // Interact with the smart contract
  const mintAuthority = web3.Keypair.generate();
  const mint = web3.Keypair.generate();

  await program.rpc.initialize(6, {
    accounts: {
      mint: mint.publicKey,
      tokenState: web3.Keypair.generate().publicKey,
      payer: wallet.publicKey,
      mintAuthority: mintAuthority.publicKey,
      systemProgram: web3.SystemProgram.programId,
      rent: web3.SYSVAR_RENT_PUBKEY,
      tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
    },
    signers: [mint],
  });

  console.log('Mint initialized');

  const fromTokenAccount = await anchor.utils.token.associatedAddress({
    mint: mint.publicKey,
    owner: wallet.publicKey,
  });

  await program.rpc.mintTokens(new anchor.BN(1000), {
    accounts: {
      mint: mint.publicKey,
      to: fromTokenAccount,
      mintAuthority: mintAuthority.publicKey,
      tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
    },
    signers: [mintAuthority],
  });

  console.log('Minted tokens');
};

main().catch(err => {
  console.error(err);
});

/*console.log("My address:", program.provider.publicKey.toString());
const balance = await program.provider.connection.getBalance(program.provider.publicKey);
console.log(`My balance: ${balance / web3.LAMPORTS_PER_SOL} SOL`);*/
