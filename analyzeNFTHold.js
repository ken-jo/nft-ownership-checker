import fs from "fs";
import Web3 from "web3";
import request from "request";

export const analyzeNftTransactionsForUsers = (userWallets) => {
  const results = [];

  userWallets.forEach((wallet) => {
    const nftHoldings = {};

    let totalPurchased = 0;
    wallet.transactions.forEach((tx) => {
      totalPurchased += parseInt(tx.price);
      const isMinted =
        tx.fromAddress === "0x0000000000000000000000000000000000000000";
      const isPurchased =
        tx.toAddress.toLowerCase() === wallet.address.toLowerCase() &&
        !isMinted;
      if (tx.toAddress.toLowerCase() === wallet.address.toLowerCase()) {
        const nftKey = `${tx.tokenAddress}_${tx.tokenId}`;
        if (!nftHoldings[nftKey]) {
          nftHoldings[nftKey] = {
            contractAddress: tx.tokenAddress,
            tokenId: tx.tokenId,
            holdTimes: [],
            minted: isMinted,
            purchased: isPurchased,
            buyingPrice: tx.price,
          };
        }

        const holdTime = Date.now() - new Date(tx.blockTimestamp);
        nftHoldings[nftKey].holdTimes.push(holdTime);
      }
    });

    const nftHoldingsArray = Object.values(nftHoldings);
    const totalHoldings = nftHoldingsArray.length;
    const averageHoldTime =
      nftHoldingsArray.reduce((acc, nft) => {
        const holdTimeSum = nft.holdTimes.reduce(
          (holdTimeSum, holdTime) => holdTimeSum + holdTime,
          0
        );
        return acc + holdTimeSum / nft.holdTimes.length;
      }, 0) / totalHoldings;

    const longestHeldNft = nftHoldingsArray.reduce(
      (acc, nft) => {
        const longestHoldTime = Math.max(...nft.holdTimes);
        if (longestHoldTime > acc.holdTime) {
          return {
            contractAddress: nft.contractAddress,
            tokenId: nft.tokenId,
            holdTime: longestHoldTime,
          };
        } else {
          return acc;
        }
      },
      { holdTime: 0 }
    );

    const mintedNftCount = nftHoldingsArray.filter((nft) => nft.minted).length;
    const highestBuyingPrice = Math.max(
      ...nftHoldingsArray
        .filter((nft) => nft.buyingPrice > 0)
        .map((nft) => nft.buyingPrice)
    );
    const purchasedNftCount = nftHoldingsArray.filter(
      (nft) => nft.purchased
    ).length;

    results.push({
      address: wallet.address,
      ethBalance: wallet.ethBalance,
      totalHoldings,
      totalPurchased,
      highestBuyingPrice,
      averageHoldTime,
      longestHeldNft,
      mintedNftCount,
      purchasedNftCount,
    });
  });

  return results;
};

// results.push({
//   address: wallet.address,
//   totalHoldings,
//   averageHoldTime,
//   longestHeldNft,
//   mintedNftCount: mintedNfts.size,
//   purchasedNftCount: purchasedNfts.size,
// });

const fetchJsonSync = (url, headers) => {
  const options = {
    uri: url,
    method: "GET",
    headers,
    json: true,
  };
  const response = request(options);
  console.log(response.json());
  return JSON.parse(response.json());
};

export const writeCsvFile = (data, filename) => {
  const header = [
    "Address",
    "ethBalance (ETH)",
    "Total Holding NFTs (nft count)",
    "Total spend ETH (ETH)",
    "Highest Buying Price (ETH)",
    "Minted NFTs (nft count)",
    "Purchased NFTs (nft count)",
    "Average Hold days (days)",
    "Longest Hold NFT (contractAddr/tokenId/days)",
  ];
  const rows = data.map((item) => {
    const longestHoldTimeInDays = Math.round(
      item.longestHeldNft.holdTime / (24 * 60 * 60 * 1000)
    );
    let totalPurchased = "NaN";
    let highestBuyingPrice = "NaN";
    let collectionName = item.longestHeldNft.contractAddress;
    try {
      totalPurchased = parseFloat(
        Web3.utils.fromWei(
          item.totalPurchased.toLocaleString("fullwide", {
            useGrouping: false,
          }),
          "ether"
        )
      ).toFixed(2);
    } catch (error) {
      console.log(
        "totalPurchased error occurred: ",
        item.totalPurchased,
        item.totalPurchased.toString(),
        error
      );
    }
    try {
      highestBuyingPrice = parseFloat(
        Web3.utils.fromWei(item.highestBuyingPrice.toString(), "ether")
      ).toFixed(2);
    } catch (error) {
      // console.log(
      //   "highestBuyingPrice error occurred: ",
      //   item.highestBuyingPrice.toString()
      // error
      // );
    }
    // try {
    //   const headers = {
    //     accept: "application/json",
    //     Authorization:
    //       "Basic " +
    //       btoa(
    //         "6552487bd71540cf90cfa93b0de457af:e985cbc2e5a44afaa83275eac7cc1688"
    //       ),
    //   };
    //   const url = `https://nft.api.infura.io/networks/1/nfts/${item.longestHeldNft.contractAddress}`;
    //   const data = fetchJsonSync(url, headers);
    //   collectionName = data.name;
    // } catch (error) {
    //   console.log(
    //     "highestBuyingPrice error occurred: ",
    //     item.highestBuyingPrice.toString(),
    //     error
    //   );
    // }
    return [
      item.address,
      item.ethBalance,
      item.totalHoldings,
      totalPurchased,
      highestBuyingPrice,
      item.mintedNftCount,
      item.purchasedNftCount,
      Math.round(item.averageHoldTime / (24 * 60 * 60 * 1000)), // 1 day
      `${collectionName}/${item.longestHeldNft.tokenId}/${longestHoldTimeInDays}`,
    ];
  });

  const csvString = [header, ...rows].map((row) => row.join(",")).join("\n");
  fs.writeFileSync(filename, csvString);
};

// const results = analyzeNftTransactionsForUsers();
// writeCsvFile(results, "nft_holdings.csv");
