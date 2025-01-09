# Stage 1: Build
FROM --platform=${BUILDPLATFORM} denoland/deno:2.0.4 AS builder

WORKDIR /deno-app

# Copy the application code
COPY ./* ./

# Compile the binary
RUN deno compile --output /app/main --allow-net --allow-read --allow-write --allow-env --unstable-cron --env-file main.ts

# Stage 2: Run
FROM gcr.io/distroless/cc

COPY --from=builder /app/main /

EXPOSE 8000

ENTRYPOINT ["/main"]