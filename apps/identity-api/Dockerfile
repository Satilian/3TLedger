FROM golang:1.23-alpine AS build
WORKDIR /src
COPY go.mod go.sum main.go ./
COPY internal ./internal
COPY cmd ./cmd
COPY migrations ./migrations
RUN CGO_ENABLED=0 go build -trimpath -o /server . \
    && CGO_ENABLED=0 go build -trimpath -o /migrate ./cmd/migrate

FROM scratch
COPY --from=build /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt
COPY --from=build /server /server
COPY --from=build /migrate /migrate
USER 65532:65532
EXPOSE 8080
ENTRYPOINT ["/server"]
