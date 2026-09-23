# ⏰ untis-ics-sync

[![Node CI](https://github.com/pipip/untis-ics-sync/actions/workflows/node-ci.yaml/badge.svg)](https://github.com/pipip/untis-ics-sync/actions/workflows/node-ci.yaml) [![Docker CD](https://github.com/pipip/untis-ics-sync/actions/workflows/docker-cd.yaml/badge.svg)](https://github.com/pipip/untis-ics-sync/actions/workflows/docker-cd.yaml)

Serves a calendar API (ICS) for events provided from Untis.

![Banner](.github/assets/banner.jpg)

## Fixes in this repo
- Fix "Doppelstunden" (make sure start is before end time)
- Add cancelled status to lessons
- Add ntfy push notification for cancelled lessons


## Use case

Some schools, universities, or workspaces do not enable the iCalendar API that Untis provides by default. Due to this limitation, I've written my implementation to dynamically sync class schedules to my agenda.

## Installation

## Using Docker

To deploy a quick Docker environment, fill in the target school credentials in `docker-compose.yml` and start the service by running `docker compose up -d`. Do note that if you'd like to use SSL, add any reverse proxy such as Nginx, Caddy or Traefik. View the table below for all possible environment variables.

## Environment
| Name | Type | Default | Description |
| - | - | - | - |
| UNTIS_SCHOOLNAME | string | `null` | The school's (Untis) service name. |
| UNTIS_USERNAME | string | `null` | The school's user name. |
| UNTIS_PASSWORD | string | `null` | The school's password. |
| UNTIS_BASEURL | string | `null` | The school's (Untis) base-url. |
| BULL_REDIS_HOST | string | `null` | The Redis service hostname or address. |
| BULL_REDIS_PORT | number | `null` | The Redis service port. |
| BULL_REDIS_PATH | string | `null` | The Redis service path for Unix socket connection. |
| CORS_ORIGIN | string | http://localhost:5173 | CORS Origin header to be sent for untis-ics-sync-ui. |
| MAINTENANCE_TITLE | string | `null` | Maintenance notification title. |
| MAINTENANCE_DESCRIPTION | string | `null` | Maintenance notification description. |
| MAINTENANCE_LOCATION | string | `null` | Maintenance notification location. |
| LESSONS_TIMETABLE_BEFORE | number | 7 | The amount of days to fetch before today. |
| LESSONS_TIMETABLE_AFTER | number | 14 | The amount of days to fetch after today. |
| NTFY_URL | string | `null` | ntfy URL like https://ntfy.xxx.de/untis |
| NTFY_TOKEN | string | `null` | ntfy token for authentication |
| NOTIFY_CLASS_IDS | string | `null` | Classes IDs comma seperated |
| NOTIFY_CHECK_INTERVAL_MINUTES | number | 5 | ntfy Intervall minutes |
| NOTIFY_CHECK_START_HOUR | number | 6 | ntfy check start hour |
| NOTIFY_CHECK_END_HOUR | number | 22 | ntfy check atop hour |

## API Documentation

Interactive API docs: http://localhost:3000/swagger

### Endpoints
 - GET /classes - List all classes
 - GET /classes/:classId - Get specific class
 - GET /subjects - List all subjects
 - GET /lessons/:classId - Get lessons (JSON)
 - GET /lessons/:classId/ics - Get ICS calendar file
        Query params: includedSubjects, excludedSubjects, alarms, offset
 - GET /holidays - Get holidays (ICS)

### Example

GET your relevant classId via /classes

Subscribe in your calendar app using: http://your-server:3000/lessons/{classId}/ics