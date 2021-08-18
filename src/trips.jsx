"use strict";

window.addEventListener("cloudkitloaded", function() {
  try {
    CloudKit.configure({
      containers: [{
        containerIdentifier: "iCloud.cloud.tavitian.commute",
        environment: "production",
        apnsEnvironment: "production",
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
  }
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
  }
  
  function goToUnauthenticatedState(error) {
    if (error && error.ckErrorCode === "AUTH_PERSIST_ERROR") {
      ckConfigErrorModal(error).show();
    }
    
    displayUsername("Unauthenticated User");
    searchBarIsVisible(false);
    unmountTrips();
    
    container
    .whenUserSignsIn()
    .then(goToAuthenticatedState)
    .catch(goToUnauthenticatedState);
  }
  
  return container.setUpAuth()
  .then(function(userIdentity) {
    if (userIdentity) {
      goToAuthenticatedState(userIdentity);
    } else {
      goToUnauthenticatedState();
    }
  })
  .catch(function(error) {
    ckConfigErrorModal(error).show();
  });
}

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
    }
  }
  
  var element = (
    <span className="navbar-text px-2">
      {usernameString}
    </span>
  );
  
  ReactDOM.render(element, document.getElementById("username"));
}

function registerForNotifications() {
  var container = CloudKit.getDefaultContainer();
  
  if (container.isRegisteredForNotifications) {
    return CloudKit.Promise.resolve();
  }
  
  container.addNotificationListener(renderNotification);
  
  function renderNotification(notification) {
    tripsChangeToast(notification);
  }
  
  return container.registerForNotifications()
  .then(function(container) {
    if (container.isRegisteredForNotifications) {
      console.log("Container is registered for notifications.");
    }
  });
}

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
  }
  
  pageIsLoading(true);
  searchBarIsVisible(false);
  
  if (queryResponse) {
    query = queryResponse;
    options = undefined;
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
  }
  
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
      }
    }
  })
  .catch(function(error) {
    pageIsLoading(false);
    searchBarIsVisible(false);
    showErrorAlert(error);
  });
}

function addTripAction() {
  addTripWorkflow().show();
  fetchStations();
}

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
  }
  
  if (queryResponse) {
    query = queryResponse;
    options = undefined;
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
  }
  
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
      }
    }
  })
  .catch(function(error) {
  });
}


function refreshTrips() {
  unmountTrips();
  fetchTrips();
}

function renderStations(records) {
  function finalElement(type) {
    var labelEl = (
      <label htmlFor={type + "DataList"} className="form-label" key={type + "LabelKey"}>
        {formLabel(type)}
      </label>
    );
    var inputEl = (
      <input className="form-control" list={type + "Options"} id={type + "DataList"} placeholder="Type to search..." key={type + "InputKey"} />
    );
    
    return (
      <div id={type} key={type + "WrapperKey"}>
        {[labelEl, inputEl, stationDatalistElement(records, type)]}
      </div>
    );
  }
  
  function formLabel(type) {
    if (type === "fromStation") {
      return "Origin";
    } else if (type === "toStation") {
      return "Destination";
    }
  }
  
  var divElement = (
    <div id="fromToStationsWrapper" key="fromToStationsWrapperKey">
      {[finalElement("fromStation"), finalElement("toStation")]}
    </div>
  );
  
  ReactDOM.render(divElement, document.getElementById("fromToStations"));
}

function renderTrips(records) {
  var elements = [];
  
  records.forEach(record => {
    elements.push(tripListItemElement(record));
  });
  
  var tripsEl = (
    <ul id="tripsList" className="list-group list-group-flush">
      {elements}
    </ul>
  );
  
  ReactDOM.render(tripsEl, document.getElementById("trips"));
}

function noTripsElement() {
  return (
    <li className="list-group-item" key="noTripsKey">
      No trips were found.
    </li>
  );
}

function stationDatalistElement(records, type) {
  var elements = [];
  
  records.forEach(record => {
    elements.push(stationOptionElement(record));
  });
  
  return (
    <datalist id={type + "Options"} key={type + "OptionsKey"}>
      {elements}
    </datalist>
  );
}

function stationOptionElement(record) {
  const fields = record.fields;
  
  return (
    <option id={fields.id.value} stopid={fields.stopId.value} value={fields.name.value} key={record.recordName} />
  );
}

function tripListItemElement(record) {
  const fields = record.fields;
  
  return (
    <li id={fields.CD_id.value} className="list-group-item" key={record.recordName}>
      {fields.CD_fromName.value.split(" Station").join("") + " to " + fields.CD_toName.value.split(" Station").join("")}
    </li>
  );
}

function searchFunction() {
  let input, filter, ul, li, i, txtValue;
  
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
    }
  }
}

function showErrorAlert(error) {
  var buttonElement = (
    <button className="btn-close" type="button" data-bs-dismiss="alert" aria-label="Close" key="closeButtonKey" />
  );
  var messageElement = (
    <p className="mb-0" key="messageKey">
      {(error.reason ? error.reason : (error.message || "An unknown error occurred."))}
    </p>
  );
  var headingElement = (
    <h5 className="alert-heading" key="headingKey">
      {(error.ckErrorCode || "Error")}
    </h5>
  );
  var alertElement = (
    <div className="alert alert-danger alert-dismissible fade show m-2" role="alert">
      {[headingElement, messageElement, buttonElement]}
    </div>
  );
  
  ReactDOM.render(alertElement, document.getElementById("alertPlaceholder"));
}

function pageIsLoading(bool) {  
  if (typeof bool === "boolean") {
    if (bool) {
      var spanElement = (
        <span className="visually-hidden">
          Loading...
        </span>
      );
      var spinnerEl = (
        <div className="spinner-border m-5" role="status">
          {spanElement}
        </div>
      );
      var centerEl = (
        <div className="d-flex justify-content-center">
          {spinnerEl}
        </div>
      );
      
      ReactDOM.render(centerEl, document.getElementById("spinner"));
    } else {
      unmountSpinner();
    }
  }
}

function unmountSpinner() {
  ReactDOM.unmountComponentAtNode(document.getElementById("spinner"));
}

function searchBarIsVisible(bool) {
  if (typeof bool === "boolean") {
    if (bool) {
      var addButtonEl = (
        <button className="btn btn-primary col-1" type="button" onClick={() => addTripAction()} key="addButtonKey">
          Add
        </button>
      );
      var refreshButtonEl = (
        <button className="btn btn-secondary col-1" type="button" onClick={() => refreshTrips()} key="refreshButtonKey">
          Refresh
        </button>
      );
      var searchBarEl = (
        <input id="tripsSearch" className="form-control col" onKeyUp={() => searchFunction()} type="text" placeholder = "Search Trips" key="searchKey" />
      );
      var searchBarRowEl = (
        <div className="row m-2 gap-2">
          {[searchBarEl, refreshButtonEl, addButtonEl]}
        </div>
      );
      
      ReactDOM.render(searchBarRowEl, document.getElementById("searchBar"));
    } else {
      unmountSearchBar();
    }
  }
}

function unmountTrips() {
  ReactDOM.unmountComponentAtNode(document.getElementById("trips"));
}

function unmountSearchBar() {
  ReactDOM.unmountComponentAtNode(document.getElementById("searchBar"));
}

function tripsChangeToast(notification) {  
  var bodyEl = (
    <div className="toast-body" key={notification.notificationID + "-bodyKey"}>
      A change has been made to your saved trips from another device. Please refresh.
    </div>
  );
  var titleEl = (
    <strong className="me-auto" key={notification.notificationID + "-titleKey"}>
      Change made to Trips
    </strong>
  );
  var closeButton = (
    <button className="btn-close" type="button" data-bs-dismiss="toast" aria-label="Close" key={notification.notificationID + "-closeButtonKey"} />
  );
  var toastHeader = (
    <div className="toast-header" key={notification.notificationID + "-headerKey"}>
      {[titleEl, closeButton]}
    </div>
  );
  var toastEl = (
    <div id={notification.notificationID} className="toast" role="alert" aria-live="assertive" aria-atomic="true">
      {[toastHeader, bodyEl]}
    </div>
  );
  
  ReactDOM.render(toastEl, document.getElementById("toastPlaceholder"));
  
  var toastElList = [].slice.call(document.querySelectorAll(".toast"))
  var toastList = toastElList.map(function(toastElem) {
    toastElem.addEventListener("hidden.bs.toast", function() {
      unmountToast();
    })
    new bootstrap.Toast(toastElem).show();
  })
}

function unmountToast() {
  ReactDOM.unmountComponentAtNode(document.getElementById("toastPlaceholder"));
}

function errorToast(error) {
  var toastContainer = document.getElementById("toastPlaceholder");
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
}

function errorModal(error) {
  var modalElement = document.createElement("div");
  var dialogElement = document.createElement("div");
  var contentElement = document.createElement("div");
  var headerElement = document.createElement("div");
  var titleElement = document.createElement("h5");
  var headerButtonElement = document.createElement("button");
  var bodyElement = document.createElement("div");
  var bodyParagraphElement = document.createElement("p");
  var footerElement = document.createElement("div");
  var closeButton = document.createElement("button");
  var retryButton = document.createElement("button");
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
  retryButton.onclick = () => fetchTrips();
  retryButton.setAttribute("data-bs-dismiss", "modal");
  retryButton.textContent = "Retry";
  footerElement.append(closeButton, retryButton);
  bodyElement.append(bodyParagraphElement);
  headerElement.append(titleElement, headerButtonElement);
  contentElement.append(headerElement, bodyElement, footerElement);
  dialogElement.append(contentElement);
  modalElement.append(dialogElement);
  return new bootstrap.Modal(modalElement);
}

function addTripWorkflow() {
  var modalElement = document.createElement("div");
  var dialogElement = document.createElement("div");
  var contentElement = document.createElement("div");
  var headerElement = document.createElement("div");
  var titleElement = document.createElement("h5");
  var headerButtonElement = document.createElement("button");
  var bodyElement = document.createElement("div");
  var fromToStationsEl = document.createElement("div");
  var footerElement = document.createElement("div");
  var cancelButton = document.createElement("button");
  var addButton = document.createElement("button");
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
  addButton.onclick = () => fetchTrips();
  addButton.setAttribute("data-bs-dismiss", "modal");
  addButton.textContent = "Add";
  footerElement.append(cancelButton, addButton);
  bodyElement.append(fromToStationsEl);
  headerElement.append(titleElement, headerButtonElement);
  contentElement.append(headerElement, bodyElement, footerElement);
  dialogElement.append(contentElement);
  modalElement.append(dialogElement);
  modalElement.addEventListener("hidden.bs.modal", function(event) {
    var modalEl = document.getElementById("addTripModal");
    var modal = bootstrap.Modal.getInstance(modalEl);
    modal.dispose();
    modalEl.remove();
  });
  return new bootstrap.Modal(modalElement);
}

function ckConfigErrorModal(error) {
  var modalElement = document.createElement("div");
  var dialogElement = document.createElement("div");
  var contentElement = document.createElement("div");
  var headerElement = document.createElement("div");
  var titleElement = document.createElement("h5");
  var headerButtonElement = document.createElement("button");
  var bodyElement = document.createElement("div");
  var bodyParagraphElement = document.createElement("p");
  var footerElement = document.createElement("div");
  var closeButton = document.createElement("button");
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
}

function uuidv4() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == "x" ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}