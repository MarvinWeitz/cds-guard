# A self-contained image for CI systems without Node.js (Jenkins, plain runners):
#   docker run --rm -v "$PWD:/repo" -w /repo ghcr.io/cbs-consulting/cds-guard check
# The project's own @sap/cds is used when node_modules is present; otherwise the bundled one.
FROM node:22-alpine
ARG CDS_GUARD_VERSION=0
ARG CDS_VERSION=10
RUN npm install --global --no-audit --no-fund "cds-guard@${CDS_GUARD_VERSION}" "@sap/cds@${CDS_VERSION}" && npm cache clean --force
ENTRYPOINT ["cds-guard"]
CMD ["check"]
