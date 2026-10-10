/// <reference types="cypress" />
/* eslint-disable no-console */
const { rm } = require("fs");

/**
 * @type {Cypress.PluginConfig}
 */
module.exports = (on, config) => {
  on("task", {
    deleteFolder(folderName) {
      console.log("deleting folder %s", folderName);

      return new Promise((resolve, reject) => {
        rm(folderName, { maxRetries: 10, recursive: true, force: true }, (err) => {
          if (err) {
            console.error(err);

            return reject(err);
          }

          resolve(null);
        });
      });
    },
  });
};
