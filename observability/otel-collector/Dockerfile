# The official OpenTelemetry Collector image is distroless and its binary is
# dynamically linked against /lib/ld-linux-*.so. On some local container
# runtimes (e.g. colima/Lima on Apple Silicon) the loader is missing from the
# scratch base and the container fails with "exec ... no such file or
# directory". We re-home the exact same upstream binary onto a slim glibc base
# so the dynamic loader is present. Functionally identical, just portable.
FROM otel/opentelemetry-collector-contrib:0.156.0 AS upstream

FROM debian:bookworm-slim
COPY --from=upstream /otelcol-contrib /otelcol-contrib
ENTRYPOINT ["/otelcol-contrib"]
