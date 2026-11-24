FROM golang:1.23-alpine AS build
WORKDIR /src
COPY . ./
RUN CGO_ENABLED=0 go build -trimpath -o /server .

FROM scratch
COPY --from=build /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt
COPY --from=build /server /server
USER 65532:65532
EXPOSE 8080
ENTRYPOINT ["/server"]
