"use strict";

window.addEventListener("cloudkitloaded", function() {
  try {
    CloudKit.configure({
      containers: [{
        containerIdentifier: "iCloud.cloud.tavitian.commute",
        environment: "production",
        apnsEnvironment: "production",
        apiTokenAuth: {
          apiToken: "4ff6e686d07f5c352890701bcff389ed23a506ddfc27a57b8cb8118f16f82ba",
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
    registerForNotifications();
    fetchTrips();
    
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
    clearTrips();
    
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
  var usernameString;
  
  if (typeof userIdentity === "string") {
    usernameString = userIdentity;
  } else {
    var nameObject = userIdentity.nameComponents;
    
    if (nameObject) {
      usernameString = nameObject.givenName + " " + nameObject.familyName;
    } else {
      usernameString = "User record name: " + userIdentity.userRecordName;
    };
  };
  
  var element = React.createElement(
    "span",
    {className: "navbar-text px-2"},
    usernameString
  );
  
  ReactDOM.render(element, document.getElementById("username"));
};

function registerForNotifications() {
  var container = CloudKit.getDefaultContainer();
  
  if (container.isRegisteredForNotifications) {
    return CloudKit.Promise.resolve();
  };
  
  container.addNotificationListener(renderNotification);
  
  function renderNotification(notification) {
    tripsChangeToast(notification).show();
  };
  
  return container.registerForNotifications()
  .then(function(container) {
    if (container.isRegisteredForNotifications) {
      console.log("Container is registered for notifications.");
    };
  });
};

function fetchTrips(queryResponse, previousTrips) {
  var container = CloudKit.getDefaultContainer();
  var database = container.privateCloudDatabase;
  
  let query;
  let options;
  
  var trips = [];
  
  if (previousTrips) {
    previousTrips.forEach(trip => {
      trips.push(trip);
    });
  };
  
  pageIsLoading(true);
  searchBarIsVisible(false);
  
  if (queryResponse) {
    query = queryResponse;
    options = null;
  } else {
    query = {
      recordType: "CD_Trip",
      sortBy: [
        {
          fieldName: "CD_fromName",
          ascending: true
        },
        {
          fieldName: "CD_toName",
          ascending: true
        }
      ]
    };
    options = {
      zoneID: {
        zoneName: "com.apple.coredata.cloudkit.zone"
      },
      resultsLimit: 200,
      desiredKeys: [
        "CD_id",
        "CD_fromId",
        "CD_fromStopId",
        "CD_fromName",
        "CD_toId",
        "CD_toStopId",
        "CD_toName"
      ],
      numbersAsStrings: false
    };
  };
  
  database.performQuery(query, options)
  .then(function(response) {
    if (response.hasErrors) {
      throw response.errors[0];
    } else if (response.isQueryResponse) {
      response.records.forEach(record => {
        trips.push(record);
      });
      
      if (response.moreComing) {
        fetchTrips(response, trips);
      } else {
        renderTrips(trips);
        pageIsLoading(false);
        searchBarIsVisible(true);
      };
    };
  })
  .catch(function(error) {
    pageIsLoading(false);
    searchBarIsVisible(false);
    showErrorAlert(error);
  });
};

function addTripAction() {
  addTripWorkflow().show();
  fetchStations();
};

function fetchStations(queryResponse, previousStations) {
  var container = CloudKit.getDefaultContainer();
  var database = container.publicCloudDatabase;
  
  let query;
  let options;
  
  var stations = [];
  
  if (previousStations) {
    previousStations.forEach(station => {
      stations.push(station);
    });
  };
  
  if (queryResponse) {
    query = queryResponse;
    options = null;
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
      resultsLimit: 200,
      numbersAsStrings: false
    };
  };
  
  database.performQuery(query, options)
  .then(function(response) {
    if (response.hasErrors) {
      throw response.errors[0];
    } else if (response.isQueryResponse) {
      response.records.forEach(record => {
        stations.push(record);
      });
      
      if (response.moreComing) {
        fetchStations(response, stations);
      } else {
        renderStations(stations);
      };
    };
  })
  .catch(function(error) {
  });
};


function refreshTrips() {
  clearTrips();
  fetchTrips();
};

function renderStations(records) {
  function finalElement(type) {
    var labelEl = React.createElement(
      "label",
      {htmlFor: type + "DataList", className: "form-label", key: type + "LabelKey"},
      formLabel(type)
    );
    var inputEl = React.createElement(
      "input",
      {className: "form-control", list: type + "Options", id: type + "DataList", placeholder: "Type to search...", key: type + "InputKey"}
    );
    
    return React.createElement(
      "div",
      {id: type, key: type + "WrapperKey"},
      [labelEl, inputEl, stationDatalistElement(records, type)]
    );
  };
  
  function formLabel(type) {
    if (type == "fromStation") {
      return "Origin";
    } else if (type == "toStation") {
      return "Destination";
    };
  };
  
  var divElement = React.createElement(
    "div",
    {id: "fromToStationsWrapper", key: "fromToStationsWrapperKey"},
    [finalElement("fromStation"), finalElement("toStation")]
  );
  
  ReactDOM.render(divElement, document.getElementById("fromToStations"));
};

function renderTrips(records) {
  var elements = [];
  
  records.forEach(record => {
    elements.push(tripListItemElement(record));
  });
  
  var tripsEl = React.createElement(
    "ul",
    {className: "list-group list-group-flush", id: "tripsList"},
    elements
  );
  
  ReactDOM.render(tripsEl, document.getElementById("trips"));
};

function noTripsElement() {
  return React.createElement(
    "li",
    {className: "list-group-item", key: "noTrips"},
    "No trips were found."
  );
};

function stationDatalistElement(records, type) {
  var elements = [];
  
  records.forEach(record => {
    elements.push(stationOptionElement(record));
  });
  
  return React.createElement(
    "datalist",
    {id: type + "Options", key: type + "OptionsKey"},
    elements
  );
};

function stationOptionElement(record) {
  const fields = record.fields;
  
  return React.createElement(
    "option",
    {id: fields.id.value, stopid: fields.stopId.value, value: fields.name.value, key: record.recordName}
  );
};

function tripListItemElement(record) {
  const fields = record.fields;
  
  return React.createElement(
    "li",
    {className: "list-group-item", key: record.recordName, id: fields.CD_id.value},
    fields.CD_fromName.value.split(" Station").join("") + " to " + fields.CD_toName.value.split(" Station").join("")
  );
};

function searchFunction() {
  var input, filter, ul, li, a, i, txtValue;
  
  input = document.getElementById("tripsSearch");
  filter = input.value.toUpperCase();
  ul = document.getElementById("tripsList");
  li = ul.getElementsByTagName("li");
  
  for (i = 0; i < li.length; i++) {
    txtValue = li[i].textContent || li[i].innerText;
    
    if (txtValue.toUpperCase().indexOf(filter) > -1) {
      li[i].style.display = "";
    } else {
      li[i].style.display = "none";
    };
  };
};

function showErrorAlert(error) {
  let buttonElement = React.createElement(
    "button",
    {className: "btn-close", type: "button", "data-bs-dismiss": "alert", "aria-label": "Close", key: "closeButton"}
  );
  let messageElement = React.createElement(
    "p",
    {className: "mb-0", key: "message"},
    (error.reason ? error.reason : (error.message || "An unknown error occurred."))
  );
  let headingElement = React.createElement(
    "h5",
    {className: "alert-heading", key: "heading"},
    (error.ckErrorCode || "Error")
  );
  let alertElement = React.createElement(
    "div",
    {className: "alert alert-danger alert-dismissible fade show m-2", role: "alert"},
    [headingElement, messageElement, buttonElement]
  );
  
  ReactDOM.render(alertElement, document.getElementById("alertPlaceholder"));
};

function pageIsLoading(bool) {  
  if (typeof bool === "boolean") {
    if (bool) {
      var spanElement = React.createElement(
        "span",
        {className: "visually-hidden"},
        "Loading..."
      );
      var spinnerEl = React.createElement(
        "div",
        {className: "spinner-border m-5", role: "status"},
        spanElement
      );
      var centerEl = React.createElement(
        "div",
        {className: "d-flex justify-content-center"},
        spinnerEl
      );
      
      ReactDOM.render(centerEl, document.getElementById("spinner"));
    } else {
      ReactDOM.unmountComponentAtNode(document.getElementById("spinner"));
    };
  };
};

function searchBarIsVisible(bool) {
  if (typeof bool === "boolean") {
    if (bool) {
      var addButtonEl = React.createElement(
        "button",
        {className: "btn btn-primary col-1", type: "button", onClick: function() {addTripAction()}, key: "addButton"},
        "Add"
      );
      var refreshButtonEl = React.createElement(
        "button",
        {className: "btn btn-secondary col-1", type: "button", onClick: function() {refreshTrips()}, key: "refreshButton"},
        "Refresh"
      );
      var searchBarEl = React.createElement(
        "input",
        {className: "form-control col", id: "tripsSearch", onKeyUp: function() {searchFunction()}, type: "text", placeholder: "Search Trips", key: "search"}
      );
      var searchBarRowEl = React.createElement(
        "div",
        {className: "row m-2 gap-2"},
        [searchBarEl, refreshButtonEl, addButtonEl]
      );
      
      ReactDOM.render(searchBarRowEl, document.getElementById("searchBar"));
    } else {
      ReactDOM.unmountComponentAtNode(document.getElementById("searchBar"));
    };
  };
};

function clearTrips() {
  ReactDOM.unmountComponentAtNode(document.getElementById("trips"));
};

function tripsChangeToast(notification) {
  var toastContainer = document.getElementById("toastStack");
  var toastEl = document.createElement("div");
  var toastHeader = document.createElement("div");
  var titleEl = document.createElement("strong");
  var closeButton = document.createElement("button");
  var bodyEl = document.createElement("div");
  toastEl.id = notification.notificationID;
  toastEl.className = "toast";
  toastEl.setAttribute("role", "alert");
  toastEl.setAttribute("aria-live", "assertive");
  toastEl.setAttribute("aria-atomic", "true");
  toastHeader.className = "toast-header";
  titleEl.className = "me-auto";
  titleEl.innerText = "Change made to Trips"
  closeButton.className = "btn-close";
  closeButton.setAttribute("type", "button");
  closeButton.setAttribute("data-bs-dismiss", "toast");
  closeButton.setAttribute("aria-label", "Close");
  toastHeader.append(titleEl, closeButton);
  bodyEl.className = "toast-body";
  bodyEl.innerText = "A change has been made to your saved trips from another device. Please refresh.";
  toastEl.append(toastHeader, bodyEl);
  toastContainer.append(toastEl);
  return new bootstrap.Toast(document.getElementById(toastEl.id));
}

function errorToast(error) {
  var toastContainer = document.getElementById("toastStack");
  var toastEl = document.createElement("div");
  var toastHeader = document.createElement("div");
  var titleEl = document.createElement("strong");
  var closeButton = document.createElement("button");
  var bodyEl = document.createElement("div");
  toastEl.id = (error.uuid || uuidv4());
  toastEl.className = "toast";
  toastEl.setAttribute("role", "alert");
  toastEl.setAttribute("aria-live", "assertive");
  toastEl.setAttribute("aria-atomic", "true");
  toastHeader.className = "toast-header";
  titleEl.className = "me-auto";
  titleEl.innerText = (error.ckErrorCode || "Error");
  closeButton.className = "btn-close";
  closeButton.setAttribute("type", "button");
  closeButton.setAttribute("data-bs-dismiss", "toast");
  closeButton.setAttribute("aria-label", "Close");
  toastHeader.append(titleEl, closeButton);
  bodyEl.className = "toast-body";
  bodyEl.innerText = (error.reason ? error.reason : (error.message || "An unknown error occurred."));
  toastEl.append(toastHeader, bodyEl);
  toastContainer.append(toastEl);
  return new bootstrap.Toast(document.getElementById(toastEl.id));
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
  modalElement.id = (error.uuid || uuidv4());
  modalElement.classList.add("modal");
  modalElement.classList.add("fade");
  modalElement.setAttribute("tabindex", "-1");
  modalElement.setAttribute("aria-labelledby", "label-" + modalElement.id);
  modalElement.setAttribute("aria-hidden", "true");
  dialogElement.className = "modal-dialog";
  contentElement.className = "modal-content";
  headerElement.className = "modal-header";
  titleElement.id = "label-" + modalElement.id;
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
  retryButton.onclick = function () {fetchTrips()};
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

function addTripWorkflow() {
  let modalElement = document.createElement("div");
  let dialogElement = document.createElement("div");
  let contentElement = document.createElement("div");
  let headerElement = document.createElement("div");
  let titleElement = document.createElement("h5");
  let headerButtonElement = document.createElement("button");
  let bodyElement = document.createElement("div");
  let fromToStationsEl = document.createElement("div");
  let footerElement = document.createElement("div");
  let cancelButton = document.createElement("button");
  let addButton = document.createElement("button");
  modalElement.id = "addTripModal";
  modalElement.classList.add("modal");
  modalElement.classList.add("fade");
  modalElement.setAttribute("tabindex", "-1");
  modalElement.setAttribute("aria-labelledby", "label-" + modalElement.id);
  modalElement.setAttribute("aria-hidden", "true");
  dialogElement.className = "modal-dialog";
  contentElement.className = "modal-content";
  headerElement.className = "modal-header";
  titleElement.id = "label-" + modalElement.id;
  titleElement.className = "modal-title";
  titleElement.innerText = "New Trip";
  headerButtonElement.className = "btn-close";
  headerButtonElement.setAttribute("type", "button");
  headerButtonElement.setAttribute("data-bs-dismiss", "modal");
  headerButtonElement.setAttribute("aria-label", "Close");
  bodyElement.className = "modal-body";
  fromToStationsEl.id = "fromToStations";
  footerElement.className = "modal-footer";
  cancelButton.classList.add("btn");
  cancelButton.classList.add("btn-secondary");
  cancelButton.setAttribute("type", "button");
  cancelButton.setAttribute("data-bs-dismiss", "modal");
  cancelButton.textContent = "Cancel";
  addButton.classList.add("btn");
  addButton.classList.add("btn-primary");
  addButton.setAttribute("type", "button");
  addButton.onclick = function () {fetchTrips()};
  addButton.setAttribute("data-bs-dismiss", "modal");
  addButton.textContent = "Add";
  footerElement.append(cancelButton, addButton);
  bodyElement.append(fromToStationsEl);
  headerElement.append(titleElement, headerButtonElement);
  contentElement.append(headerElement, bodyElement, footerElement);
  dialogElement.append(contentElement);
  modalElement.append(dialogElement);
  modalElement.addEventListener("hidden.bs.modal", function (event) {
    var modalEl = document.getElementById("addTripModal");
    var modal = bootstrap.Modal.getInstance(modalEl);
    modal.dispose();
    modalEl.remove();
  });
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
  modalElement.id = (error.uuid || uuidv4());
  modalElement.classList.add("modal");
  modalElement.classList.add("fade");
  modalElement.setAttribute("tabindex", "-1");
  modalElement.setAttribute("aria-labelledby", "label-" + modalElement.id);
  modalElement.setAttribute("aria-hidden", "true");
  dialogElement.className = "modal-dialog";
  contentElement.className = "modal-content";
  headerElement.className = "modal-header";
  titleElement.id = "label-" + modalElement.id;
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

function uuidv4() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == "x" ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};