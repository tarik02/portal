---
'@tarik02/portal-client': minor
'@tarik02/portal-core': minor
'@tarik02/portal-server': minor
---

send initial location in hello

The portal handshake now includes the current page location in the initial `hello`
event, and the client seeds its location state from that value before later
`location.changed` updates arrive.
