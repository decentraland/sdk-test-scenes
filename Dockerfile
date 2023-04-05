FROM node:lts-alpine

# Create app directory
WORKDIR /usr/src/app

COPY ./test-scenes/ .

RUN npm i -g decentraland@next
RUN npm i -g @dcl/sdk@next
RUN npm install

ENV CI true

EXPOSE 8000
CMD [ "dcl", "start", "--ci", "--skip-build", "--skip-install" ]