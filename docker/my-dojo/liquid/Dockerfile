FROM    debian:buster


#################################################################
# INSTALL LIQUID
#################################################################
ENV     LIQUID_HOME        /home/liquid
ENV     LIQUID_VERSION     0.18.1.6
ENV     LIQUID_URL         https://github.com/ElementsProject/elements/releases/download/elements-0.18.1.6/elements-0.18.1.6-x86_64-linux-gnu.tar.gz
ENV     LIQUID_SHA256      50c273648ff650d7e2e5b0707953877f490aa3b5b4e82bdf06323d99ad881a73
ENV     LIQUID_ASC_URL     https://github.com/ElementsProject/elements/releases/download/elements-0.18.1.6/SHA256SUMS.asc
ENV     LIQUID_PGP_KS_URI  hkp://keyserver.ubuntu.com:80
ENV     LIQUID_PGP_KEY     01EA5486DE18A882D4C2684590C8019E36C2E964

RUN     set -ex && \
        apt-get update && \
        apt-get install -qq --no-install-recommends ca-certificates dirmngr gosu gpg gpg-agent wget && \
        rm -rf /var/lib/apt/lists/*

# Build and install liquid binaries
RUN     set -ex && \
        cd /tmp && \
        wget -qO liquid.tar.gz "$LIQUID_URL" && \
        echo "$LIQUID_SHA256 liquid.tar.gz" | sha256sum -c - && \
        gpg --batch --keyserver "$LIQUID_PGP_KS_URI" --recv-keys "$LIQUID_PGP_KEY" && \
        wget -qO liquid.asc "$LIQUID_ASC_URL" && \
        gpg --batch --verify liquid.asc && \
        tar -xzvf liquid.tar.gz -C /usr/local --strip-components=1 --exclude=*-qt && \
        rm -rf /tmp/*

# Create groups liquid & tor
# Create user liquid and add it to groups
RUN     addgroup --system -gid 1108 liquid && \
        addgroup --system -gid 1107 tor && \
        adduser --system --ingroup liquid -uid 1105 liquid && \
        usermod -a -G tor liquid

# Create data directory
RUN     mkdir "$LIQUID_HOME/.elements" && \
        chown -h liquid:liquid "$LIQUID_HOME/.elements"

# Copy restart script
COPY    ./restart.sh /restart.sh
RUN     chown liquid:liquid /restart.sh && \
        chmod 777 /restart.sh

# Copy wait-for-it script
COPY    ./wait-for-it.sh /wait-for-it.sh

RUN     chown liquid:liquid /wait-for-it.sh && \
        chmod u+x /wait-for-it.sh && \
        chmod g+x /wait-for-it.sh

EXPOSE  8333 9501 9502 28256

USER    liquid