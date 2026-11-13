# A self-contained image for CI systems without Node.js (Jenkins, plain runners):
#   docker run --rm -v "$PWD:/repo" -w /repo ghcr.io/cbs-consulting/cds-guard check
# The project's own @sap/cds is used when node_modules is present; otherwise the bundled one.
#
# The release workflow builds it from the packed package:
#   npm pack && docker build -t cds-guard .
FROM node:22-alpine
ARG CDS_VERSION=10
LABEL org.opencontainers.image.source="https://github.com/cbs-consulting/cds-guard" \
      org.opencontainers.image.description="Stops accidental changes to protected CDS entities, annotations, code blocks and files." \
      org.opencontainers.image.licenses="Apache-2.0"
# git lets "check --base" show what changed; the mounted repository belongs to another user.
RUN apk add --no-cache git && git config --system --add safe.directory '*'
COPY cbs-consulting-cds-guard-*.tgz /tmp/cds-guard.tgz
RUN npm install --global --no-audit --no-fund /tmp/cds-guard.tgz "@sap/cds@${CDS_VERSION}" && rm /tmp/cds-guard.tgz && npm cache clean --force
ENTRYPOINT ["cds-guard"]
CMD ["check"]
