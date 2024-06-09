import BN from "bn.js";
import assert from "assert";
import * as web3 from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { assert } from "chai";
import { MemeToken } from "../target/types/memetoken";
import type { Memetoken } from "../target/types/memetoken";

describe("memetoken", () => {
  // Configure the client to use the local cluster
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.Memetoken as anchor.Program<Memetoken>;
  
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Memetoken as Program<MemeToken>;

  const mintAuthority = Keypair.generate();
  const freezeAuthority = Keypair.generate();
  const tokenState = Keypair.generate();
  const payer = provider.wallet.publicKey;
  let mint: PublicKey = null;
  let fromTokenAccount: PublicKey = null;
  let toTokenAccount: PublicKey = null;

  it("Is initialized!", async () => {
    mint = await PublicKey.createWithSeed(
      payer,
      "mint",
      program.programId
    );

    await program.methods
      .initialize(6) // 6 decimals
      .accounts({
        mint,
        tokenState: tokenState.publicKey,
        payer,
        mintAuthority: mintAuthority.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        tokenProgram: anchor.spl.token.TOKEN_PROGRAM_ID,
      })
      .signers([tokenState])
      .rpc();

    const mintAccount = await anchor.spl.token.getMint(
      provider.connection,
      mint
    );

    assert.equal(mintAccount.decimals, 6);
  });

  it("Mints tokens", async () => {
    fromTokenAccount = await anchor.spl.token.createAccount(
      provider.connection,
      payer,
      mint,
      mintAuthority.publicKey
    );

    await program.methods
      .mintTokens(new anchor.BN(1000))
      .accounts({
        mint,
        to: fromTokenAccount,
        mintAuthority: mintAuthority.publicKey,
        tokenProgram: anchor.spl.token.TOKEN_PROGRAM_ID,
      })
      .signers([mintAuthority])
      .rpc();

    const accountInfo = await anchor.spl.token.getAccount(
      provider.connection,
      fromTokenAccount
    );

    assert.equal(accountInfo.amount.toString(), "1000");
  });

  it("Transfers tokens", async () => {
    toTokenAccount = await anchor.spl.token.createAccount(
      provider.connection,
      payer,
      mint,
      payer
    );

    await program.methods
      .transferTokens(new anchor.BN(500))
      .accounts({
        from: fromTokenAccount,
        to: toTokenAccount,
        authority: mintAuthority.publicKey,
        tokenProgram: anchor.spl.token.TOKEN_PROGRAM_ID,
      })
      .signers([mintAuthority])
      .rpc();

    const fromAccountInfo = await anchor.spl.token.getAccount(
      provider.connection,
      fromTokenAccount
    );

    const toAccountInfo = await anchor.spl.token.getAccount(
      provider.connection,
      toTokenAccount
    );

    assert.equal(fromAccountInfo.amount.toString(), "500");
    assert.equal(toAccountInfo.amount.toString(), "500");
  });

  it("Burns tokens", async () => {
    await program.methods
      .burnTokens(new anchor.BN(200))
      .accounts({
        mint,
        from: fromTokenAccount,
        authority: mintAuthority.publicKey,
        tokenProgram: anchor.spl.token.TOKEN_PROGRAM_ID,
      })
      .signers([mintAuthority])
      .rpc();

    const fromAccountInfo = await anchor.spl.token.getAccount(
      provider.connection,
      fromTokenAccount
    );

    assert.equal(fromAccountInfo.amount.toString(), "300");
  });

  it("Pauses the contract", async () => {
    await program.methods
      .pause()
      .accounts({
        tokenState: tokenState.publicKey,
        owner: payer,
      })
      .rpc();

    const tokenStateAccount = await program.account.tokenState.fetch(
      tokenState.publicKey
    );

    assert.isTrue(tokenStateAccount.paused);
  });

  it("Unpauses the contract", async () => {
    await program.methods
      .unpause()
      .accounts({
        tokenState: tokenState.publicKey,
        owner: payer,
      })
      .rpc();

    const tokenStateAccount = await program.account.tokenState.fetch(
      tokenState.publicKey
    );

    assert.isFalse(tokenStateAccount.paused);
  });

  it("Transfers ownership", async () => {
    const newOwner = Keypair.generate();

    await program.methods
      .transferOwnership(newOwner.publicKey)
      .accounts({
        tokenState: tokenState.publicKey,
        owner: payer,
      })
      .signers([payer])
      .rpc();

    const tokenStateAccount = await program.account.tokenState.fetch(
      tokenState.publicKey
    );

    assert.equal(tokenStateAccount.owner.toString(), newOwner.publicKey.toString());
  });
});
