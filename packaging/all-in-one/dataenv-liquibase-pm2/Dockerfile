ARG DATAENV_PM2_IMAGE=benxianyu/apitable-dataenv-pm2
ARG DATAENV_PM2_IMAGE_TAG=latest

# The MySQL driver is fetched from Maven Central and verified by SHA256. The
# previous `lpm add mysql --global` resolved whatever version the upstream
# index pointed at, installed it somewhere unpredictable (/liquibase_libs or
# /root/.liquibase) and aborted the whole build when the download failed its
# checksum check.
# Prepare stage on the same AlmaLinux base and Corretto toolchain as the final
# image. Everything installed here (JDK, download tools, Liquibase, the MySQL
# driver) is reduced to a jlink runtime and the /liquibase tree below.
#
# The runtime is built with ALL-MODULE-PATH: it keeps the full module set (TLS,
# fonts for the PDF export path, jdk.unsupported, ...) while dropping jmods,
# headers, sources, man pages and debug symbols.
FROM ${DATAENV_PM2_IMAGE}:${DATAENV_PM2_IMAGE_TAG} AS prepare

ARG LIQUIBASE_VERSION=4.21.1
ARG LB_SHA256=c04542865e5ece8b7b1ee9bd6beaefc5315e350620288d6ac1a2d32c3b1f7d8b
ARG MYSQL_DRIVER_VERSION=8.0.33
ARG MYSQL_DRIVER_SHA256=e2a3b2fc726a1ac64e998585db86b30fa8bf3f706195b78bb77c5f99bf877bd9

RUN set -euxo pipefail; \
  microdnf -y --disablerepo='rabbitmq_*' install findutils; \
  microdnf clean all; \
  \
  CORRETTO_VERSION=17.0.9.8-1; \
  GNUPGHOME="$(mktemp -d)"; \
  export GNUPGHOME; \
  curl -fL -o corretto.key https://yum.corretto.aws/corretto.key; \
  gpg --batch --import corretto.key; \
  gpg --batch --export --armor '6DC3636DAE534049C8B94623A122542AB04F24E3' > corretto.key; \
  rpm --import corretto.key; \
  rm -fr "$GNUPGHOME" corretto.key; \
  curl -fL -o /etc/yum.repos.d/corretto.repo https://yum.corretto.aws/corretto.repo; \
  grep -q '^gpgcheck=1' /etc/yum.repos.d/corretto.repo; \
  echo "priority=9" >> /etc/yum.repos.d/corretto.repo; \
  microdnf -y --disablerepo='rabbitmq_*' install "java-17-amazon-corretto-devel-${CORRETTO_VERSION}"; \
  \
  mkdir -p /liquibase/bin; \
  cd /liquibase; \
  curl -LO "https://github.com/liquibase/liquibase/releases/download/v${LIQUIBASE_VERSION}/liquibase-${LIQUIBASE_VERSION}.tar.gz"; \
  echo "$LB_SHA256  liquibase-${LIQUIBASE_VERSION}.tar.gz" | sha256sum -c -; \
  tar -xzf liquibase-${LIQUIBASE_VERSION}.tar.gz; \
  rm -f liquibase-${LIQUIBASE_VERSION}.tar.gz; \
  curl -fsSL -o /liquibase/lib/mysql-connector-j.jar \
    "https://repo1.maven.org/maven2/com/mysql/mysql-connector-j/${MYSQL_DRIVER_VERSION}/mysql-connector-j-${MYSQL_DRIVER_VERSION}.jar"; \
  echo "${MYSQL_DRIVER_SHA256}  /liquibase/lib/mysql-connector-j.jar" | sha256sum -c -; \
  jlink --add-modules ALL-MODULE-PATH \
        --strip-debug --no-man-pages --no-header-files \
        --compress=2 --output /opt/java-runtime; \
  /opt/java-runtime/bin/java -version

FROM ${DATAENV_PM2_IMAGE}:${DATAENV_PM2_IMAGE_TAG}

ENV LANG C.UTF-8
ENV JAVA_HOME=/opt/java-runtime
ENV LIQUIBASE_HOME=/liquibase
# $PATH still carries the openresty paths inherited from the dataenv image.
ENV PATH=${JAVA_HOME}/bin:/liquibase:${PATH}

COPY --from=prepare /opt/java-runtime /opt/java-runtime
COPY --from=prepare /liquibase /liquibase
COPY liquibase.docker.properties /liquibase/

RUN ln -s /liquibase/liquibase /usr/local/bin/liquibase \
    && java -version \
    && liquibase --version
