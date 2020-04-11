#!/bin/bash
set -e

echo "## Start elementsd #############################"

elementsd_options=(
  -chain=liquidv1
  -bind=172.28.1.10
  -datadir=/home/liquid/.elements
  -dbcache=$ELEMENTSD_DB_CACHE
  -disablewallet=1
  -dns=$ELEMENTSD_DNS
  -dnsseed=$ELEMENTSD_DNSSEED
  -externalip=$(cat /var/lib/tor/hsv2bitcoind/hostname)
  -listen=1
  -maxconnections=$ELEMENTSD_MAX_CONNECTIONS
  -maxmempool=$ELEMENTSD_MAX_MEMPOOL
  -mempoolexpiry=$ELEMENTSD_MEMPOOL_EXPIRY
  -minrelaytxfee=$ELEMENTSD_MIN_RELAY_TX_FEE
  -port=8333
  -proxy=172.28.1.4:9050
  -rpcallowip=::/0
  -rpcbind=172.28.1.5
  -rpcpassword=$ELEMENTSD_RPC_PASSWORD
  -rpcport=28256
  -rpcthreads=$ELEMENTSD_RPC_THREADS
  -rpcuser=$ELEMENTSD_RPC_USER
  -server=1
  -txindex=1
  -zmqpubhashblock=tcp://0.0.0.0:9502
  -zmqpubrawtx=tcp://0.0.0.0:9501
)

if [ "$ELEMENTSD_RPC_EXTERNAL" == "on" ]; then
  ELEMENTSD_options+=(-zmqpubhashtx=tcp://0.0.0.0:9500)
  ELEMENTSD_options+=(-zmqpubrawblock=tcp://0.0.0.0:9503)
fi

elementsd "${elementsd_options[@]}"

# Keep the container up
while true
do
  sleep 1
done
