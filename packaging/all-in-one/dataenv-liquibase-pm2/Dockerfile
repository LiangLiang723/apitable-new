ARG DATAENV_PM2_IMAGE=benxianyu/apitable-dataenv-pm2
ARG DATAENV_PM2_IMAGE_TAG=latest

# Prepare stage on the same AlmaLinux base and Corretto toolchain as the final
# image. Everything installed here (JDK, download tools, Liquibase, the MySQL
# driver) is reduced to a jlink runtime and the /liquibase tree below.
FROM ${DATAENV_PM2_IMAGE}:${DATAENV_PM2_IMAGE_TAG} AS prepare

ARG LIQUIBASE_VERSION=4.21.1
ARG LPM_VERSION=0.2.3
ARG LB_SHA256=c04542865e5ece8b7b1ee9bd6beaefc5315e350620288d6ac1a2d32c3b1f7d8b

RUN set -euxo pipefail; \
  microdnf -y --disablerepo='rabbitmq_*' install findutils unzip; \
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
  curl -LO "https://github.com/liquibase/liquibase-package-manager/releases/download/v${LPM_VERSION}/lpm-${LPM_VERSION}-linux.zip"; \
  unzip lpm-${LPM_VERSION}-linux.zip -d bin/; \
  rm -f lpm-${LPM_VERSION}-linux.zip; \
  export LIQUIBASE_HOME=/liquibase; \
  lpm update; \
  lpm add mysql --global; \
  # lpm installs --global packages outside /liquibase in some versions
  # (/liquibase_libs or /root/.liquibase). Normalise every jar into
  # /liquibase/lib so the final stage only copies /liquibase, and fail here
  # instead of shipping an image without a MySQL driver.
  for dir in /liquibase_libs /root/.liquibase; do \
    if [ -d "$dir" ]; then find "$dir" -name '*.jar' -exec cp -n {} /liquibase/lib/ \; ; fi; \
  done; \
  if ! ls /liquibase/lib/*mysql*.jar >/dev/null 2>&1; then \
    find /liquibase -path /liquibase/lib -prune -o -name '*.jar' -exec cp -n {} /liquibase/lib/ \; ; \
  fi; \
  ls /liquibase/lib/*mysql*.jar >/dev/null; \
  # Runtime only. ALL-MODULE-PATH keeps the full module set (TLS, fonts for the
  # PDF export path, jdk.unsupported, ...) while dropping jmods, headers,
  # sources, man pages and debug symbols.
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
