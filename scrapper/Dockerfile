FROM node:11-alpine

LABEL maintainer "Johan Codinha"
LABEL image_type "node web scrapper"

ENV WORKDIR /opt/scrapper
WORKDIR ${WORKDIR}

COPY . .

RUN echo "0 * * * * . /tmp/docker.env; run-parts /etc/periodic/hourly" > /var/spool/cron/crontabs/root \
    && mv scrap /etc/periodic/hourly \
    && mkdir /var/log/scrapper/ \
    && touch /var/log/scrapper/scrapper.log \
    && npm install

CMD npm run latest \
    && env > /tmp/docker.env \
    && crond -f
