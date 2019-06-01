/*!
 * tracker/transactions-bundle.js
 * Copyright © 2019 – Katana Cryptographic Ltd. All Rights Reserved.
 */
'use strict'

const _ = require('lodash')
const LRU = require('lru-cache')
const bitcoin = require('bitcoinjs-lib')
const util = require('../lib/util')
const db = require('../lib/db/mysql-db-wrapper')
const network = require('../lib/bitcoin/network')
const keys = require('../keys')[network.key]
const activeNet = network.network


/**
 * A base class defining a set of transactions (mempool, block)
 */
class TransactionsBundle {

  /**
   * Constructor
   * @param {object[]} txs - array of bitcoin transaction objects
   */
  constructor(txs) {
    // List of transactions
    this.transactions = (txs == null) ? [] : txs
  }

  /**
   * Adds a transaction
   * @param {object} tx - transaction object
   */
  addTransaction(tx) {
    if (tx) {
      this.transactions.push(tx)
    }
  }

  /**
   * Clear the bundle
   */
  clear() {
    this.transactions = []
  }

  /**
   * Return the bundle as an array of transactions
   * @returns {object[]}
   */
  toArray() {
    return this.transactions.slice()
  }

  /**
   * Get the size of the bundle
   * @returns {integer} return the number of transactions stored in the bundle
   */
  size() {
    return this.transactions.length
  }

  /**
   * Find the transactions of interest
   * @returns {object[]} returns an array of transactions objects
   */
  async prefilterTransactions() {
    // Process transactions by slices of 5000 transactions
    const MAX_NB_TXS = 5000
    const lists = util.splitList(this.transactions, MAX_NB_TXS)

    const results = await util.seriesCall(lists, list => {
      return this._prefilterTransactions(list)
    })

    return _.flatten(results)
  }

  /**
   * Find the transactions of interest (internal implementation)
   * @params {object[]} transactions - array of transactions objects
   * @returns {object[]} returns an array of transactions objects
   */
  async _prefilterTransactions(transactions) {
    let inputs = []
    let outputs = []

    // Store indices of txs to be processed
    let filteredIdxTxs = []

    // Store txs indices, keyed by `txid-outindex`.
    // Values are arrays of txs indices (for double spends)
    let indexedInputs = {}

    // Store txs indices, keyed by address.
    // Values are arrays of txs indices
    let indexedOutputs = {}

    // Stores txs indices, keyed by txids
    let indexedTxs = {}

    //
    // Prefilter against the outputs
    //

    // Index the transaction outputs
    for (const i in transactions) {
      const tx = transactions[i]
      const txid = tx.getId()

      indexedTxs[txid] = i
      
      // If we already checked this tx
      if (TransactionsBundle.cache.has(txid))
        continue 

      for (const j in tx.outs) {
        try {
          const script = tx.outs[j].script
          const address = bitcoin.address.fromOutputScript(script, activeNet)
          outputs.push(address)
          // Index the output
          if (!indexedOutputs[address])
            indexedOutputs[address] = []
          indexedOutputs[address].push(i)
        } catch (e) {}
      }
    }

    // Prefilter
    const outRes = await db.getUngroupedHDAccountsByAddresses(outputs)

    for (const i in outRes) {
      const key = outRes[i].addrAddress
      const idxTxs = indexedOutputs[key]
      if (idxTxs) {
        for (const idxTx of idxTxs)
          if (filteredIdxTxs.indexOf(idxTx) == -1)
            filteredIdxTxs.push(idxTx)
      }
    }

    //
    // Prefilter against the inputs
    //

    // Index the transaction inputs
    for (const i in transactions) {
      const tx = transactions[i]
      const txid = tx.getId()

      // If we already checked this tx
      if (TransactionsBundle.cache.has(txid))
        continue

      for (const j in tx.ins) {
        const spendHash = tx.ins[j].hash
        const spendTxid = Buffer.from(spendHash).reverse().toString('hex')
        // Check if this input consumes an output
        // generated by a transaction from this block
        if (filteredIdxTxs.indexOf(indexedTxs[spendTxid]) > -1 && filteredIdxTxs.indexOf(i) == -1) {
          filteredIdxTxs.push(i)
        } else {
          const spendIdx = tx.ins[j].index
          inputs.push({txid: spendTxid, index: spendIdx})
          // Index the input
          const key = spendTxid + '-' + spendIdx
          if (!indexedInputs[key])
            indexedInputs[key] = []
          indexedInputs[key].push(i)
        }
      }
    }

    // Prefilter
    const inRes = await db.getOutputSpends(inputs)

    for (const i in inRes) {
      const key = inRes[i].txnTxid + '-' + inRes[i].outIndex
      const idxTxs = indexedInputs[key]
      if (idxTxs) {
        for (const idxTx of idxTxs)
          if (filteredIdxTxs.indexOf(idxTx) == -1)
            filteredIdxTxs.push(idxTx)
      }
    }

    //
    // Returns the matching transactions
    //
    filteredIdxTxs.sort((a, b) => a - b);
    return filteredIdxTxs.map(x => transactions[x])
  }

}

/**
 * Cache of txids, for avoiding triple-check behavior.
 * ZMQ sends the transaction twice:
 * 1. When it enters the mempool
 * 2. When it leaves the mempool (mined or orphaned)
 * Additionally, the transaction comes in a block
 * Orphaned transactions are deleted during the routine check
 */
TransactionsBundle.cache = LRU({
  // Maximum number of txids to store in cache
  max: 100000,
  // Function used to compute length of item
  length: (n, key) => 1,
  // Maximum age for items in the cache. Items do not expire
  maxAge: Infinity
})


module.exports = TransactionsBundle
