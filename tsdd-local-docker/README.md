# TangSengDaoDao Local Docker

This compose stack builds the local edited backend and web repositories:

- Backend: `../TangSengDaoDaoServer`
- Web: `../TangSengDaoDaoWeb`
- Manager: `../TangSengDaoDaoManager`

Useful URLs:

- Web: http://127.0.0.1:8082
- Manager login: http://127.0.0.1:8083/login
- Backend API ping: http://127.0.0.1:8090/v1/ping
- WuKongIM websocket: ws://127.0.0.1:5200
- WuKongIM monitor: http://127.0.0.1:5300/web/
- MinIO console: http://127.0.0.1:9001
- Adminer: http://127.0.0.1:8306

Local credentials:

- SMS code: `123456`
- Adminer server: `mysql`
- Adminer user: `root`
- Adminer password: `local_mysql_123456`
- Adminer database: `im`
- MinIO user: `minio`
- MinIO password: `local_minio_123456`
- Manager super admin username: `superAdmin`
- Manager super admin password: `local_admin_123456`

Commands:

```sh
/Applications/Docker.app/Contents/Resources/bin/docker compose up -d --build
/Applications/Docker.app/Contents/Resources/bin/docker compose ps
/Applications/Docker.app/Contents/Resources/bin/docker compose logs -f tangsengdaodaoserver
/Applications/Docker.app/Contents/Resources/bin/docker compose down
```
