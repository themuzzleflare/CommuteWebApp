"use strict";

window.addEventListener("cloudkitloaded", function() {
  try {
    CloudKit.configure({
      containers: [{
        containerIdentifier: "iCloud.cloud.tavitian.commute",
        environment: "production",
        apiTokenAuth: {
          apiToken: "4ff6e686d07f5c352890701bcff389ed23a506ddfc27a57b8cb8118f16f82ba4",
          persist: true,
          signInButton: {
            id: "apple-sign-in-button",
            theme: "white-with-outline"
          },
          signOutButton: {
            id: "apple-sign-out-button",
            theme: "white-with-outline"
          }
        }
      }],
      services: {
        logger: console
      }
    });
    setupAuth();
  } catch (error) {
    ckConfigErrorModal(error).show();
  };
});

function setupAuth() {	
  var container = CloudKit.getDefaultContainer();
  
  function goToAuthenticatedState(userIdentity) {
    displayUsername(userIdentity);
    fetchStations();
    
    container
    .whenUserSignsOut()
    .then(goToUnauthenticatedState);
  };
  
  function goToUnauthenticatedState(error) {
    if (error && error.ckErrorCode === "AUTH_PERSIST_ERROR") {
      ckConfigErrorModal(error).show();
    };
    
    displayUsername("Unauthenticated User");
    searchBarIsVisible(false);
    clearStations();
    
    container
    .whenUserSignsIn()
    .then(goToAuthenticatedState)
    .catch(goToUnauthenticatedState);
  };
  
  return container.setUpAuth()
  .then(function(userIdentity) {
    if (userIdentity) {
      goToAuthenticatedState(userIdentity);
    } else {
      goToUnauthenticatedState();
    };
  })
  .catch(function(error) {
    ckConfigErrorModal(error).show();
  });
};

function displayUsername(userIdentity) {
  var usernameEl = document.getElementById("username");
  
  if (typeof userIdentity === "string") {
    usernameEl.innerText = userIdentity;
  } else {
    var nameObject = userIdentity.nameComponents;
    
    if (nameObject) {
      usernameEl.innerText = nameObject.givenName + " " + nameObject.familyName;
    } else {
      usernameEl.innerText = "User record name: " + userIdentity.userRecordName;
    };
  };
};

function fetchStations(queryResponse) {
  var container = CloudKit.getDefaultContainer();
  var database = container.publicCloudDatabase;
  
  let query;
  let options;
  
  pageIsLoading(true);
  
  if (queryResponse) {
    query = queryResponse;
  } else {
    query = {
      recordType: "Stations",
      sortBy: [
        {
          fieldName: "name",
          ascending: true
        }
      ]
    };
    options = {
      zoneID: {
        zoneName: "_defaultZone"
      },
      resultsLimit: 200,
      desiredKeys: [
        "name"
      ],
      numbersAsStrings: false
    };
  };
  
  database.performQuery(query, options)
  .then(function(response) {
    if (response.hasErrors) {
      throw response.errors[0];
    } else if (response.isQueryResponse) {
      renderStations(response.records);
      if (response.moreComing) {
        fetchStations(response);
      } else {
        pageIsLoading(false);
        searchBarIsVisible(true);
      };
    };
  })
  .catch(function(error) {
    pageIsLoading(false);
    errorModal(error).show();
  });
};

function renderStations(records) {
  var stationsEl = document.getElementById("stations");
  
  records.forEach(record => {
    stationsEl.append(stationListItemElement(record));
  });
};

function noStationsElement() {
  var noStationsEl = document.createElement("li");
  noStationsEl.className = "list-group-item";
  noStationsEl.innerText = "No stations were found.";
  return noStationsEl;
};

function stationListItemElement(record) {
  const fields = record.fields;
  var listGroupItemEl = document.createElement("li");
  listGroupItemEl.className = "list-group-item";
  listGroupItemEl.innerText = fields.name.value;
  return listGroupItemEl;
};

function showErrorAlert(error) {
  let alertPlaceholder = document.getElementById("alertPlaceholder");
  let alertElement = document.createElement("div");
  let headingElement = document.createElement("h5");
  let messageElement = document.createElement("p");
  let buttonElement = document.createElement("button");
  alertElement.classList.add("alert");
  alertElement.classList.add("alert-danger");
  alertElement.classList.add("alert-dismissible");
  alertElement.classList.add("fade");
  alertElement.classList.add("show");
  alertElement.setAttribute("role", "alert");
  headingElement.className = "alert-heading";
  headingElement.innerText = (error.ckErrorCode || "Error");
  messageElement.className = "mb-0";
  messageElement.innerText = (error.reason ? error.reason : (error.message || "An unknown error occurred."));
  buttonElement.className = "btn-close";
  buttonElement.setAttribute("type", "button");
  buttonElement.setAttribute("data-bs-dismiss", "alert");
  buttonElement.setAttribute("aria-label", "Close");
  alertElement.append(headingElement, messageElement, buttonElement);
  alertPlaceholder.append(alertElement);
};

function pageIsLoading(bool) {
  let spinnerEl = document.getElementById("spinner");
  
  if (typeof bool === "boolean") {
    if (bool) {
      if (spinnerEl.style.display == "none") {
        spinnerEl.style.display = "inherit";
      };
    } else {
      if (spinnerEl.style.display != "none") {
        spinnerEl.style.display = "none";
      };
    };
  };
};

function searchBarIsVisible(bool) {
  let searchBarEl = document.getElementById("searchBar");
  
  if (typeof bool === "boolean") {
    if (bool) {
      if (searchBarEl.style.display == "none") {
        searchBarEl.style.display = "inherit";
      };
    } else {
      if (searchBarEl.style.display != "none") {
        searchBarEl.style.display = "none";
      };
    };
  };
};

function clearStations() {
  var stationsEl = document.getElementById("stations");
  var child = stationsEl.lastElementChild;
  
  while (child) {
    stationsEl.removeChild(child);
    child = stationsEl.lastElementChild;
  };
};

function errorModal(error) {
  let modalElement = document.createElement("div");
  let dialogElement = document.createElement("div");
  let contentElement = document.createElement("div");
  let headerElement = document.createElement("div");
  let titleElement = document.createElement("h5");
  let headerButtonElement = document.createElement("button");
  let bodyElement = document.createElement("div");
  let bodyParagraphElement = document.createElement("p");
  let footerElement = document.createElement("div");
  let closeButton = document.createElement("button");
  let retryButton = document.createElement("button");
  modalElement.id = "errorModal";
  modalElement.classList.add("modal");
  modalElement.classList.add("fade");
  modalElement.setAttribute("tabindex", "-1");
  modalElement.setAttribute("aria-labelledby", "errorModalLabel");
  modalElement.setAttribute("aria-hidden", "true");
  dialogElement.className = "modal-dialog";
  contentElement.className = "modal-content";
  headerElement.className = "modal-header";
  titleElement.id = "errorModalLabel";
  titleElement.className = "modal-title";
  titleElement.innerText = (error.ckErrorCode || "Error");
  headerButtonElement.className = "btn-close";
  headerButtonElement.setAttribute("type", "button");
  headerButtonElement.setAttribute("data-bs-dismiss", "modal");
  headerButtonElement.setAttribute("aria-label", "Close");
  bodyElement.className = "modal-body";
  bodyParagraphElement.innerText = (error.reason ? error.reason : (error.message || "An unknown error occurred."));
  footerElement.className = "modal-footer";
  closeButton.classList.add("btn");
  closeButton.classList.add("btn-secondary");
  closeButton.setAttribute("type", "button");
  closeButton.setAttribute("data-bs-dismiss", "modal");
  closeButton.textContent = "Close";
  retryButton.classList.add("btn");
  retryButton.classList.add("btn-primary");
  retryButton.setAttribute("type", "button");
  retryButton.onclick = function () {fetchStations()};
  retryButton.setAttribute("data-bs-dismiss", "modal");
  retryButton.textContent = "Retry";
  footerElement.append(closeButton, retryButton);
  bodyElement.append(bodyParagraphElement);
  headerElement.append(titleElement, headerButtonElement);
  contentElement.append(headerElement, bodyElement, footerElement);
  dialogElement.append(contentElement);
  modalElement.append(dialogElement);
  return new bootstrap.Modal(modalElement);
};

function ckConfigErrorModal(error) {
  let modalElement = document.createElement("div");
  let dialogElement = document.createElement("div");
  let contentElement = document.createElement("div");
  let headerElement = document.createElement("div");
  let titleElement = document.createElement("h5");
  let headerButtonElement = document.createElement("button");
  let bodyElement = document.createElement("div");
  let bodyParagraphElement = document.createElement("p");
  let footerElement = document.createElement("div");
  let closeButton = document.createElement("button");
  modalElement.id = "errorModal";
  modalElement.classList.add("modal");
  modalElement.classList.add("fade");
  modalElement.setAttribute("tabindex", "-1");
  modalElement.setAttribute("aria-labelledby", "errorModalLabel");
  modalElement.setAttribute("aria-hidden", "true");
  dialogElement.className = "modal-dialog";
  contentElement.className = "modal-content";
  headerElement.className = "modal-header";
  titleElement.id = "errorModalLabel";
  titleElement.className = "modal-title";
  titleElement.innerText = (error.ckErrorCode || "Error");
  headerButtonElement.className = "btn-close";
  headerButtonElement.setAttribute("type", "button");
  headerButtonElement.setAttribute("data-bs-dismiss", "modal");
  headerButtonElement.setAttribute("aria-label", "Close");
  bodyElement.className = "modal-body";
  bodyParagraphElement.innerText = (error.reason ? error.reason : (error.message || "An unknown error occurred."));
  footerElement.className = "modal-footer";
  closeButton.classList.add("btn");
  closeButton.classList.add("btn-secondary");
  closeButton.setAttribute("type", "button");
  closeButton.setAttribute("data-bs-dismiss", "modal");
  closeButton.textContent = "Close";
  footerElement.append(closeButton);
  bodyElement.append(bodyParagraphElement);
  headerElement.append(titleElement, headerButtonElement);
  contentElement.append(headerElement, bodyElement, footerElement);
  dialogElement.append(contentElement);
  modalElement.append(dialogElement);
  return new bootstrap.Modal(modalElement);
};