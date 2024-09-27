import Web3 from "web3";
import fs from "fs";

const config = {
  providerUrl:
    "https://eth-mainnet.g.alchemy.com/v2/HvSf_aXTTmTGfC8RBH8yOofy1PIoVfkX",
};

const web3 = new Web3(new Web3.providers.HttpProvider(config.providerUrl));

const BLOCK_DATA_FILE = "blockData.json";

const getBlockNumberThreeMonthsAgo = async () => {
  const currentBlockNumber = await web3.eth.getBlockNumber();
  const blocksPerMonth = 15 * 4 * 60 * 24 * 1;
  const blocksPerThreeMonths = blocksPerMonth * 1;
  const blockNumberThreeMonthsAgo = currentBlockNumber - blocksPerThreeMonths;
  return blockNumberThreeMonthsAgo;
};

const getBlockData = async (blockNumber) => {
  let blockData = {};

  if (fs.existsSync(BLOCK_DATA_FILE)) {
    blockData = JSON.parse(fs.readFileSync(BLOCK_DATA_FILE));
  }

  if (!blockData[blockNumber]) {
    blockData[blockNumber] = await web3.eth.getBlock(blockNumber, true);
    fs.writeFileSync(BLOCK_DATA_FILE, JSON.stringify(blockData));
  }

  return blockData[blockNumber];
};

const getTransactionsByAccount = async (
  account,
  startBlockNumber,
  endBlockNumber
) => {
  const transactions = [];

  for (let i = startBlockNumber; i <= endBlockNumber; i++) {
    const block = await getBlockData(i);

    if (block && block.transactions) {
      block.transactions.forEach((tx) => {
        if (tx.from === account || tx.to === account) {
          transactions.push(tx);
        }
      });
    }
  }

  return transactions;
};

const analyzeNftTransactionsForUsers = async (userNftData) => {
  const startBlockNumber = await getBlockNumberThreeMonthsAgo();
  const endBlockNumber = await web3.eth.getBlockNumber();

  for (const userData of userNftData) {
    const userAddress = userData.address;
    const nftData = userData.nfts;
    const nftDataMap = new Map(
      nftData.map((nft) => [
        nft.contractAddress.toLowerCase() + nft.tokenId,
        nft,
      ])
    );
    const transactions = await getTransactionsByAccount(
      userAddress,
      startBlockNumber,
      endBlockNumber
    );

    const nftTransactions = transactions.filter((tx) => {
      const isNftTransfer = nftDataMap.has(
        tx.to.toLowerCase() +
          tx.input.slice(10 + 24, 10 + 24 + 64).toLowerCase()
      );
      return isNftTransfer;
    });

    const nftHoldings = {};

    nftTransactions.forEach((tx) => {
      const nftKey =
        tx.to.toLowerCase() +
        tx.input.slice(10 + 24, 10 + 24 + 64).toLowerCase();
      const nft = nftDataMap.get(nftKey);

      if (tx.from.toLowerCase() === userAddress.toLowerCase()) {
        // NFT를 전송한 경우
        nftHoldings[nft.tokenId] = false;
      } else if (tx.to.toLowerCase() === userAddress.toLowerCase()) {
        // NFT를 획득한 경우
        nftHoldings[nft.tokenId] = true;
      }
    });

    const nftHeldForThreeMonths = Object.values(nftHoldings).filter(
      (isHeld) => isHeld
    ).length;

    console.log(
      `지갑 주소 ${userAddress}는(은) 3개월 이상 보유한 NFT가 ${nftHeldForThreeMonths}개 있습니다.`
    );
    return userAddress, nftHeldForThreeMonths;
  }
};

export default analyzeNftTransactionsForUsers;
