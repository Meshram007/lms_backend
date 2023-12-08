const Web3 = require("web3");

async function confirm(tx) {
  const web3 = await new Web3(
    new Web3.providers.HttpProvider(
      "https://attentive-blissful-spree.matic.quiknode.pro/bd22a8a5c97205dab253abd759c5ad2a2a6e4582/"
    )
  );

  const contractAddress = "0x25204087ac0aD19b77c8736ce6B88df87c63Cd4d";
  const account = "0x8d7a67E6501224fdF75fa13a6b3db6C11C942f92";
  const gasPrice = await web3.eth.getGasPrice();

  const encodedTx = tx.encodeABI();

  const nonce = await web3.eth.getTransactionCount(account);

  const gasLimit = 1000000;

  const transactionObject = {
    nonce: web3.utils.toHex(nonce),
    from: account,
    to: contractAddress,
    gasLimit: web3.utils.toHex(gasLimit),
    gasPrice: web3.utils.toHex(gasPrice),
    data: encodedTx,
  };

  const signedTransaction = await web3.eth.accounts.signTransaction(
    transactionObject,
    ""
  ); 

  const ok = await web3.eth.sendSignedTransaction(
    signedTransaction.rawTransaction
  );

  hash = signedTransaction.transactionHash;

  console.log("hash", hash);

  return hash;
}

module.exports = confirm;
