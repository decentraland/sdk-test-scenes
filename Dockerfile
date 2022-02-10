FROM node:lts-alpine

# Create app directory
WORKDIR /usr/src/app

COPY test-scenes/scene.json ./

# RUN npm install --global decentraland@next
RUN npm i -g decentraland@next

COPY test-scenes/package*.json ./
RUN npm install

COPY ./test-scenes/ .

EXPOSE 8000
CMD [ "npm", "start", "--", "--ci", "--skip-build" ]