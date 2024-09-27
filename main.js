import fetch from "node-fetch";
import Web3 from "web3";
import fs from "fs";

import {
  analyzeNftTransactionsForUsers,
  writeCsvFile,
} from "./analyzeNFTHold.js";
import { userAddress } from "./wallet.js";

const config = {
  providerUrl:
    "https://eth-mainnet.g.alchemy.com/v2/INSERT_YOUR_KEY",
  sliceWindow: 50,
};

const web3 = new Web3(new Web3.providers.HttpProvider(config.providerUrl));

const headers = {
  accept: "application/json",
  Authorization:
    "Basic " +
    btoa("INSERT_YOUR_KEY"),
};

const userAddresses = userAddress;
const userWallets = [];

const fetchNftTransactions = (address) => {
  return new Promise(async (resolve, reject) => {
    let transfers = [];
    let responseCursor = null;
    let ethBalance = 0.0;
    try {
      ethBalance = await web3.eth.getBalance(address);
      ethBalance = parseFloat(Web3.utils.fromWei(ethBalance, "ether")).toFixed(
        3
      );

      do {
        const url = responseCursor
          ? `https://nft.api.infura.io/networks/1/accounts/${address}/assets/transfers?cursor=${responseCursor}`
          : `https://nft.api.infura.io/networks/1/accounts/${address}/assets/transfers`;

        const response = await fetch(url, { headers });
        const data = await response.json();

        transfers = transfers.concat(data.transfers);
        responseCursor = data.cursor;
      } while (responseCursor !== null);
    } catch (error) {}

    const value = { address, ethBalance, transactions: transfers };
    if (value) {
      return resolve(value);
    }
    return reject(value);
  });
};

const fetchNFTTransactionsForAll = async (usingPromiseAllSettled) => {
  const total_count = userAddresses.length;
  console.log(`Total user Address count: ${total_count}`);
  let currentIndex = 0;

  // Check if there is existing data, and start from the next wallet
  if (fs.existsSync("./userWallets.json")) {
    const userWalletsData = JSON.parse(fs.readFileSync("./userWallets.json"));
    currentIndex = userWalletsData.length;
    userWallets.push(...userWalletsData);
    console.log(`[${currentIndex}/${total_count}] Complete load saved tx data`);
  }

  while (currentIndex < userAddresses.length) {
    try {
      if (usingPromiseAllSettled) {
        const walletBatch = userAddresses.slice(
          currentIndex,
          currentIndex + config.sliceWindow
        );
        const walletPromises = walletBatch.map(fetchNftTransactions);
        const walletData = await Promise.allSettled(walletPromises);
        walletData.forEach((result, idx) => {
          if (result.status === "fulfilled") {
            userWallets.push(result.value);
            console.log(
              `NFT transactions for ${result.value.address} successfully collected`
            );
            console.log(
              `[${currentIndex + idx + 1}/${total_count}] Collecting done by ${
                result.value.address
              }'s nft tx / tx.length: ${result.value.transactions.length}`
            );
          } else {
            console.log(
              `Error collecting NFT transactions for ${
                userAddresses[currentIndex + walletData.indexOf(result)]
              }: ${result.reason}`
            );
          }
        });
        currentIndex += config.sliceWindow;
      } else {
        const userWallet = await fetchNftTransactions(
          userAddresses[currentIndex++]
        );
        userWallets.push(userWallet);
        console.log(
          `[${currentIndex}/${total_count}] Collecting done by ${userAddresses[currentIndex]}'s nft tx. ${userWallet.transactions.length}`
        );
      }

      // Save userWallets as a JSON file after every 10 wallets processed
      if (currentIndex % 10 === 0) {
        fs.writeFileSync(
          "./userWallets.json",
          JSON.stringify(userWallets, null, 2)
        );
        console.log("---- Saved data");
      }
    } catch (err) {
      console.log(`error occur`, err);
    }
  }

  // Save userWallets as a final JSON file
  fs.writeFileSync("./userWallets.json", JSON.stringify(userWallets, null, 2));
  console.log("All NFT transactions collected");
};

const main = async () => {
  const usingPromiseAllSettled = true;
  // Get all user NFT transfer transaction.
  await fetchNFTTransactionsForAll(usingPromiseAllSettled);

  const results = analyzeNftTransactionsForUsers(userWallets);
  writeCsvFile(results, "nft_holdings.csv");
  console.log("Saved");
};

const runMain = async () => {
  try {
    await main();
    process.exit(0);
  } catch (error) {
    console.log(error);
    process.exit(1);
  }
};

runMain();
