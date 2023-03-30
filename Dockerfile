FROM node:lts-alpine

# Create app directory
WORKDIR /usr/src/app

COPY ./test-scenes/ .

RUN npm i -g decentraland@next
RUN npm install

EXPOSE 8000
CMD [ "dcl", "--ci", "--skip-build", "--skip-install" ]