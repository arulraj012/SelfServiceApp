sap.ui.define([
	"./BaseController",
	"sap/ui/model/json/JSONModel",
    "../model/formatter",
    "sap/m/FeedListItem",
    "sap/m/ListType",
    "sap/m/library",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/m/Dialog",
    "sap/m/DialogType",
    "sap/m/Label",
	"sap/m/Text",
    "sap/m/TextArea",
    "sap/m/Button",
    "sap/m/ButtonType",
    "sap/ui/core/Core"
], function (BaseController, JSONModel, formatter, FeedListItem, ListType, mobileLibrary, MessageBox, MessageToast, Dialog, DialogType, Label,  Text, TextArea, Button, ButtonType, Core) {
	"use strict";

	// shortcut for sap.m.URLHelper
	var URLHelper = mobileLibrary.URLHelper;

	return BaseController.extend("gfservicerequests.controller.Detail", {

		formatter: formatter,
		app: null,
		fileToUpload: null,
		/* =========================================================== */
		/* lifecycle methods                                           */
		/* =========================================================== */

		onInit: function() {

			// Model used to manipulate control states. The chosen values make sure,
			// detail page is busy indication immediately so there is no break in
			// between the busy indication for loading the view's meta data
			var oViewModel = new JSONModel({
				busy: false,
				delay: 0
			});
			this.createNewTicket = false;
			var oView = this.getView();
			var _self = this;
			this.getRouter().getRoute("object").attachPatternMatched(this._onObjectMatched, this);
			this.setModel(oViewModel, "detailView");
			var isMock = this.getOwnerComponent().mockData;
			if (isMock) {
				this._onMetadataLoaded();
				var mockModel = new JSONModel(jQuery.sap.getModulePath("ServiceRequests") + "/mock/serviceMockData.json");
				mockModel.attachRequestCompleted(function() {
					var mockModelData = this.getData();
					oView.setModel(new JSONModel(mockModelData.ServiceRequest), "ServiceRequest");
					oView.setModel(new JSONModel(mockModelData.LifeCycleModel), "LifeCycleModel");
					oView.setModel(new JSONModel({results: []}), "IncidentModel");
					_self.selectInfoService();
					_self.setSelectsToBusy(false);
					// _self.getIncidentCategoryList();
					_self.mockModelLoaded = true;
				});
				this.setModel(mockModel, "MockModel");
			} else {
				this.getOwnerComponent().getModel().metadataLoaded().then(this._onMetadataLoaded.bind(this));
			}
			var URLS = this.getOwnerComponent().SELECT_BOX_URLS;
			this.app = this.getOwnerComponent().getAggregation("rootControl");
			this.app.setBusyIndicatorDelay(0);
			oView.setBusyIndicatorDelay(0);
			if (isMock) {
				var serviceModel = oView.getModel("ServiceRequest");
				if (!serviceModel) {
					this.setSelectsToBusy(true);
				}
			} else {
				var url = jQuery.sap.getModulePath("servicerequestportal") + "/destinations/c4c/sap/byd/odata/v1/c4codata/";
                var incidentModel = new JSONModel({results: []});
                var categoryModel = new JSONModel({results: []});
				// var oModel = new ODataModel(url, {json: true, useBatch: false});
				// oModel.read(URLS.ServicePriorityCode, {
				// 	success: _self.infoPriorityReceived.bind(_self),
				// 	error: _self.onErrorODataRead
                // });
                var oModel = this.getOwnerComponent().getModel();
				this.setModel(oModel, "ServiceRequest");
                this.setModel(incidentModel, "IncidentModel");
                this.setModel(categoryModel, "categoryModel");
                this.categoryLoaded();
                
			}
        },
        categoryLoaded: function() {
            var serviceCategoryModel = this.getOwnerComponent().getModel();
            var filter1 = new sap.ui.model.Filter("BusinessTransactionDocumentProcessingTypeCode", "EQ", "ZDO");
            serviceCategoryModel.read("/ServiceCategoryCatalogueUsageCollection", {
                urlParameters: {
					"$expand": "ServiceCategoryCatalogue,ServiceCategoryCatalogue/ServiceCategory/ServiceCategoryDescription"
				},
                    filters: [filter1],//this.getOwnerComponent().createIncidentCategoryFilters(selectedData.ParentObjectID, selectedData.TypeCode),
                    success: this.onCategoryLoaded.bind(this),
                    error: this.onIncidentFailed.bind(this)
                });
            // var categoryModel = this.oDialog.getModel("categoryModel");
			// categoryModel.setData(oModel);
			// categoryModel.refresh();
        },
        onCategoryLoaded: function(oData) {
            
            var categoryArray = [];
			var categoryModel = this.getModel("categoryModel");
            var oCatelogItem = oData.results.filter(function (odealItem1) {
								return odealItem1.ServiceCategoryCatalogue.EndDateTime > new Date();
                            });
            if(oCatelogItem.length > 0) {
                for(var i = 0; i < oCatelogItem.length; i++) {
                    var oCatelogCategory = oCatelogItem[i].ServiceCategoryCatalogue.ServiceCategory
                    var catalogue = oCatelogCategory.filter(function (category) {
                        return category.TypeCode === "1";
                    });
                    for(var j=0; j < catalogue.length; j++) {
                        var category = {};
                        category.Code = catalogue[j].ID;    
                    category.Description = catalogue[j].ServiceCategoryDescription[0].Description;
                    categoryArray.push(category);
                    }
                    
                }
            }
			categoryModel.setData(categoryArray);
			categoryModel.refresh();
			// sap.ui.getCore().byId("createIncidentCategory").setBusy(false);
        },
        onIncidentFailed: function(jqXHR) {
			var error = jqXHR.responseJSON.error.message.value;
			MessageBox.error(error);
			this.getView().byId("createIncidentCategory").setBusy(false);

		},
		selectInfoService: function() {
			var oView = this.getView(),
				oElementBinding = oView.getElementBinding(),
				sPath;
			if (oElementBinding) {
				sPath = oElementBinding.getPath();
			} else {
				//if no element was selected, select first on mockItems
				sPath = '/ServiceRequestCollection/0';
			}
			var oModel = this.getModel(),
				selectedKey = oModel.getObject(sPath).ServiceIssueCategoryID;
			oView.byId("infoServiceCategorySelect").setSelectedKey(selectedKey);
		},
		onErrorODataRead: function(jqXHR) {
			var error = jqXHR.responseJSON.error.message.value;
			MessageBox.error(error);
		},
		infoPriorityReceived: function(oData) {
			var hiddenPriorityCodes = this.getOwnerComponent().getManifest()['sap.cloud.portal'].settings.hiddenPriorityCodes,
				priorityData = oData.results,
				filteredPriorityData = [];
			if (hiddenPriorityCodes) {
				for (var i = 0; i < priorityData.length; i++) {
					if (hiddenPriorityCodes.indexOf(parseInt(priorityData[i].Code)) === -1) {
						filteredPriorityData.push(priorityData[i]);
					}
				}
			}
			var lifeCycleModel = new JSONModel({filteredResults: filteredPriorityData, results: priorityData}),
				oView = this.getView();
			oView.setModel(lifeCycleModel, "LifeCycleModel");
		},

		setSelectsToBusy: function(val) {
			var oView = this.getView();
			oView.byId("infoPrioritySelect").setBusy(val);
			oView.byId("infoProductCategorySelect").setBusy(val);
			oView.byId("infoServiceCategorySelect").setBusy(val);
			oView.byId("infoIncidentCategorySelect").setBusy(val);
        },
        onSetToInProcessStatus: function(oEvent) {
			var patch = {ServiceRequestUserLifeCycleStatusCode: "2"},
				oModel = this.getModel(),
				oView = this.getView();
            this.app.setBusy(true);
            var that=this;
			var sPath = oView.getElementBinding().getPath(),
				url = oModel.sServiceUrl + sPath,
				token = oModel.getSecurityToken();
			jQuery.ajax({
				url: url,
				method: "PATCH",
				contentType: "application/json",
				headers: {
					"X-CSRF-TOKEN": token
				},
				data: JSON.stringify(patch),
				success: function() {
					MessageToast.show("The service request was set to In Process");
                    that.getModel().refresh();
                //     that.getView().byId("setToAcceptBtn").setVisible(false);
                // that.getView().byId("setToRejectBtn").setVisible(false);
                    that.app.setBusy(false);
				}.bind(this),
				error: function(jqXHR) {
					var elm = jqXHR.responseXML.getElementsByTagName("message")[0];
					var error = elm.innerHTML || elm.textContent;
					MessageBox.error(error);
				},
				complete: function() {
					this.app.setBusy(false);
					// this._setEditMode(false);
				}.bind(this)
			});
        },

		onPost: function(oEvent) {
			var view = this.getView(),
				model = view.getModel(),
				sPath = view.getElementBinding().getPath(),
                authorUUID = this.getOwnerComponent().contactUUID,
                AuthorID = this.getOwnerComponent().contactID,
				text = oEvent.getSource().getValue();
			if (!this.getOwnerComponent().mockData) {
				var url = model.sServiceUrl + sPath + "/ServiceRequestTextCollection",
					token = model.getSecurityToken();
				this.app.setBusy(true);
				jQuery.ajax({
					url: url,
					method: "POST",
					contentType: "application/json",
					headers: {
						"X-CSRF-TOKEN": token
					},
					data: JSON.stringify({
						TypeCode: "10008",
                        AuthorUUID: authorUUID,
                        AuthorID: AuthorID,
						Text: text
					}),
					success: function() {
                        var oPath = sPath.split("/")
                        var status = this.getModel().oData[oPath[1]].ServiceRequestUserLifeCycleStatusCode;
                        if (status === "4") {
                            this.onSetToInProcessStatus();
                        } else {
                        this.getModel().refresh();
                        }
					}.bind(this),
					error: function(jqXHR) {
                        var elm = jqXHR.responseXML.getElementsByTagName("message")[0];
						var error = elm.innerHTML || elm.textContent;
                        // this.app.setBusy(false);
						// var error = "Ticket is Locked in C4C System";//jqXHR.responseJSON.error.message.value;
						MessageBox.error(error);
					}.bind(this),
					complete: function() {
						this.app.setBusy(false);
					}.bind(this)
				});
			} else {
				var serviceData = model.getData().ServiceRequestCollection[parseInt(view.getElementBinding().getPath().split("/")[2])].ServiceRequestDescription;
				var user = sap.ushell.Container.getUser();
				var dataDescription = {
					TypeCode: "10008",
					AuthorName: user.getFullName(),
					Text: text,
					CreatedOn: new Date()
				};
				serviceData.push(dataDescription);
				model.refresh();
				this._populateDescriptionsList(view.getElementBinding().getPath());
			}
		},

		onAttachmentPress: function(oEvent) {
			var item = oEvent.getParameter("listItem");
			var link = document.createElement("a");
			if (item.data("uri").fileBlob) {
				link.href = URL.createObjectURL(item.data("uri").fileBlob);
				link.download = item.data("uri").Name;
			} else {
				link.href = item.data("uri");
				link.download = item.getAggregation("cells")[0].getText();
			}
			link.click();
		},
		onEdit: function() {
			this._setEditMode(true);
		},
		onCancel: function() {
			this._setEditMode(false);
		},
		onSave: function() {
			var view = this.getView(),
				model = view.getModel();
			var patch = {
				ServicePriorityCode: view.byId("infoPrioritySelect").getSelectedKey(),
				ProductID: view.byId("infoProductCategorySelect").getSelectedKey(),
				ServiceIssueCategoryID: view.byId("infoServiceCategorySelect").getSelectedKey(),
				IncidentServiceIssueCategoryID: view.byId("infoIncidentCategorySelect").getSelectedKey()
			};

			var patchMock = {
				ServicePriorityCode: view.byId("infoPrioritySelect").getSelectedKey(),
				ServicePriorityCodeText: view.byId("infoPrioritySelect").getSelectedItem().getProperty("text"),
				ProductID: view.byId("infoProductCategorySelect").getSelectedKey(),
				ServiceIssueCategoryID: view.byId("infoServiceCategorySelect").getSelectedKey()
			};

			if (this.getOwnerComponent().mockData) {
				var sPathMock = view.getElementBinding().getPath(),
					ind = parseInt(sPathMock.split('/')[2]),
					data = model.getData(),
					arr = data.ServiceRequestCollection,
					objToUpdate = arr[ind];
				jQuery.extend(true, objToUpdate, patchMock);
				MessageToast.show("The service request was updated successfully");
				model.setData(data);
				model.refresh(true);
				this._setEditMode(false);
			} else {
				this.app.setBusy(true);
				var sPath = view.getElementBinding().getPath(),
					url = model.sServiceUrl + sPath,
					token = model.getSecurityToken();
				jQuery.ajax({
					url: url,
					method: "PATCH",
					contentType: "application/json",
					headers: {
						"X-CSRF-TOKEN": token
					},
					data: JSON.stringify(patch),
					success: function() {
						MessageToast.show("The service request was updated successfully");
						this.getModel().refresh();
					}.bind(this),
					error: function(jqXHR) {
						var elm = jqXHR.responseXML.getElementsByTagName("message")[0];
						var error = elm.innerHTML || elm.textContent;
						MessageBox.error(error);
					},
					complete: function() {
						this.app.setBusy(false);
						this._setEditMode(false);
					}.bind(this)
				});
			}
		},

		onServiceCategorySelect: function() {
			// this.getIncidentCategoryList();
		},

		onSetToComplete: function(oEvent) {
			var patch = {ServiceRequestLifeCycleStatusCode: "3"},
				oModel = this.getModel(),
				oView = this.getView();
			this.app.setBusy(true);
			var sPath = oView.getElementBinding().getPath(),
				url = oModel.sServiceUrl + sPath,
				token = oModel.getSecurityToken();
			jQuery.ajax({
				url: url,
				method: "PATCH",
				contentType: "application/json",
				headers: {
					"X-CSRF-TOKEN": token
				},
				data: JSON.stringify(patch),
				success: function() {
					MessageToast.show("The service request was set to completed");
					this.getModel().refresh();
				}.bind(this),
				error: function(jqXHR) {
					var elm = jqXHR.responseXML.getElementsByTagName("message")[0];
					var error = elm.innerHTML || elm.textContent;
					MessageBox.error(error);
				},
				complete: function() {
					this.app.setBusy(false);
					this._setEditMode(false);
				}.bind(this)
			});
		},
		onFileChange: function(oEvent) {
			this.fileToUpload = oEvent.getParameter("files")["0"];
		},
		onFileUpload: function() {
			if (this.fileToUpload) {
				this.app.setBusy(true);
				var fileReader = new FileReader();
				fileReader.onload = this.uploadFile.bind(this);
				fileReader.readAsBinaryString(this.fileToUpload);
			} else {
				MessageBox.show("No file was selected");
			}
		},
		uploadFile: function(e) {
			var view = this.getView(),
				model = view.getModel(),
				sPath = view.getElementBinding().getPath();
            var oName = this.getOwnerComponent().name + "," + this.fileToUpload.name;

			if (!this.getOwnerComponent().mockData) {
				var url = model.sServiceUrl + sPath + "/ServiceRequestAttachmentFolder",
					token = model.getSecurityToken();
				var dataMock = {
					Name: oName,
                    Binary: window.btoa(e.target.result),
                    TypeCode: "ZA1"
				};
				jQuery.ajax({
					url: url,
					method: "POST",
					contentType: "application/json",
					headers: {
						"X-CSRF-TOKEN": token
					},
					data: JSON.stringify(dataMock),
					success: function() {
						view.byId("fileUploader").clear();
						this.fileToUpload = null;
                        MessageToast.show("The attachment was uploaded successfully");
                        var oPath = sPath.split("/")
                        var status = this.getModel().oData[oPath[1]].ServiceRequestUserLifeCycleStatusCode;
                        if (status === "4") {
                            this.onSetToInProcessStatus(); 
                        } else {
                        this.getModel().refresh();
                        }
					}.bind(this),
					error: function(jqXHR) {
						var elm = jqXHR.responseXML.getElementsByTagName("message")[0];
						var error = elm.innerHTML || elm.textContent;
						MessageBox.error(error);
					},
					complete: function() {
						this.app.setBusy(false);
					}.bind(this)
				});
			} else {
				var data = {
					Name: this.fileToUpload.name,
					fileBlob: new Blob([this.fileToUpload], {type: "any"})
				};
				var attachmentData = model.getData().ServiceRequestCollection[parseInt(view.getElementBinding().getPath().split("/")[2])].ServiceRequestAttachmentFolder;
				attachmentData.push(data);
				model.refresh();
				view.byId("fileUploader").clear();
				this.fileToUpload = null;
				MessageToast.show("The attachment was uploaded successfully");
				this._populateAttachmentsList(view.getElementBinding().getPath());
			}
		},
		initIncidentModel: function(data) {
			var oView = this.getView(),
				incidentModel = oView.getModel("IncidentModel");
			incidentModel.setData(data);
			incidentModel.refresh();
			oView.byId("infoIncidentCategorySelect").setBusy(false);
		},
		onErrorIncidentModel: function(jqXHR) {
			var error = jqXHR.responseJSON.error.message.value;
			MessageBox.error(error);
			this.getView().byId("infoIncidentCategorySelect").setBusy(false);
		},
		// getIncidentCategoryList: function() {
		// 	var oView = this.getView(),
		// 		parentObject = oView.byId("infoServiceCategorySelect").getSelectedItem().data("parentObject"),
        //         typeCode = oView.byId("infoServiceCategorySelect").getSelectedItem().data("typeCode"),
		// 		oModel = oView.getModel("ServiceRequest"),
		// 		_self = this,
		// 		URLS = this.getOwnerComponent().SELECT_BOX_URLS;
		// 	oView.byId("infoIncidentCategorySelect").setBusy(true);
		// 	if (this.getOwnerComponent().mockData) {
		// 		var mockModelData = oView.getModel("MockModel").getData();
		// 		var incidentModel = mockModelData.ServiceRequest.IncidentModel;
		// 		this.initIncidentModel(incidentModel[parentObject]);
		// 	} else {
		// 		oModel.read(URLS.ServiceCategory, {
        //             filters: this.getOwnerComponent().createIncidentCategoryFilters(parentObject, typeCode),
		// 			success: _self.initIncidentModel.bind(_self),
		// 			error: _self.onErrorIncidentModel.bind(_self)
		// 		});
		// 	}

		// },
		/* =========================================================== */
		/* begin: internal methods                                     */
		/* =========================================================== */
		_setEditMode: function(isEdit) {
			var view = this.getView();
			view.byId("save").setVisible(isEdit);
			view.byId("cancel").setVisible(isEdit);
			// view.byId("edit").setVisible(!isEdit);
			// view.byId("infoPrioritySelect").setEnabled(isEdit);
			// view.byId("infoProductCategorySelect").setEnabled(isEdit);
			// view.byId("infoServiceCategorySelect").setEnabled(isEdit);
			// view.byId("infoIncidentCategorySelect").setEnabled(isEdit);
		},
		/**
		 * Binds the view to the object path and expands the aggregated line items.
		 * @function
		 * @param {sap.ui.base.Event} oEvent pattern match event in route 'object'
		 * @private
		 */
		_onObjectMatched: function(oEvent) {
			var sObjectId = oEvent.getParameter("arguments").objectId;
			if (this.getOwnerComponent().mockData) {
				var collection = this.getModel().getData().ServiceRequestCollection;
				for (var i = 0; i < collection.length; i++) {
					if (collection[i].ObjectID === sObjectId) {
						break;
					}
				}
				this._bindView("/ServiceRequestCollection/" + i);
			} else {
				this.getModel().metadataLoaded().then(function() {
					var sObjectPath = this.getModel().createKey("ServiceRequestCollection", {
						ObjectID: sObjectId
					});
					this._bindView("/" + sObjectPath);
				}.bind(this));
            }
            var sObjectPath = this.getModel().createKey("ServiceRequestCollection", {
					ObjectID :  sObjectId
				});
                this.getView().byId("interactionInput").setValue("");
            var status = this.getModel().oData[sObjectPath].ServiceRequestUserLifeCycleStatusCode;
            if (status === "5") {
                this.getView().byId("setToAcceptBtn").setVisible(true);
                this.getView().byId("setToRejectBtn").setVisible(true);
                this.getView().byId("idNoteLabel").setVisible(true);
                this.getView().byId("idNote").setVisible(true);
                // this.getView().byId("idNote").setEnabled(false);
                this.getView().byId("interactionInput").setVisible(false);
                this.getView().byId("idLableAttach").setVisible(false);
                this.getView().byId("fileUploader").setVisible(false);
                this.getView().byId("uploadFileButton").setVisible(false);
            } else if (status === "6") {
                this.getView().byId("setToAcceptBtn").setVisible(false);
                this.getView().byId("setToRejectBtn").setVisible(false);
                this.getView().byId("interactionInput").setVisible(false);
                this.getView().byId("idLableAttach").setVisible(false);
                this.getView().byId("fileUploader").setVisible(false);
                this.getView().byId("uploadFileButton").setVisible(false);
                this.getView().byId("idNoteLabel").setVisible(true);
                this.getView().byId("idNote").setVisible(true);
                this.getView().byId("idNote").setEnabled(false);
            } else {
                this.getView().byId("setToAcceptBtn").setVisible(false);
                this.getView().byId("setToRejectBtn").setVisible(false);
                this.getView().byId("idNoteLabel").setVisible(false);
                this.getView().byId("idNote").setVisible(false);
                this.getView().byId("interactionInput").setVisible(true);
                this.getView().byId("idLableAttach").setVisible(true);
                this.getView().byId("fileUploader").setVisible(true);
                this.getView().byId("uploadFileButton").setVisible(true);
            }

		},
		/**
		 * Binds the view to the object path. Makes sure that detail view displays
		 * a busy indicator while data for the corresponding element binding is loaded.
		 * @function
		 * @param {string} sObjectPath path to the object to be bound to the view.
		 * @private
		 */
		_bindView: function(sObjectPath) {
			// Set busy indicator during view binding
			var oViewModel = this.getModel("detailView");
			// If the view was not bound yet its not busy, only if the binding requests data it is set to busy again
			oViewModel.setProperty("/busy", false);
			this.getView().bindElement({
				path: sObjectPath,
				parameters: {
					expand: "ServiceRequestTextCollection,ServiceRequestAttachmentFolder"
				},
				events: {
					change: this._onBindingChange.bind(this),
					dataRequested: function() {
						oViewModel.setProperty("/busy", true);
					},
					dataReceived: function() {
                        oViewModel.setProperty("/busy", false);
                        this._populateDescriptionsList(sObjectPath);
                        this._populateAttachmentsList(sObjectPath);
                        var status = this.getView().getModel().getData(sObjectPath).ServiceRequestUserLifeCycleStatusCode;
                        if (status === "5") {
                            this.getView().byId("setToAcceptBtn").setVisible(true);
                            this.getView().byId("setToRejectBtn").setVisible(true);
                            this.getView().byId("idNoteLabel").setVisible(true);
                            this.getView().byId("idNote").setVisible(true);
                            this.getView().byId("interactionInput").setVisible(false);
                            this.getView().byId("idLableAttach").setVisible(false);
                            this.getView().byId("fileUploader").setVisible(false);
                            this.getView().byId("uploadFileButton").setVisible(false);
                            this.getView().byId("idNote").setEnabled(false);
                        } else if (status === "6") {
                            this.getView().byId("setToAcceptBtn").setVisible(false);
                            this.getView().byId("setToRejectBtn").setVisible(false);
                            this.getView().byId("interactionInput").setVisible(false);
                            this.getView().byId("idLableAttach").setVisible(false);
                            this.getView().byId("fileUploader").setVisible(false);
                            this.getView().byId("uploadFileButton").setVisible(false);
                            this.getView().byId("idNoteLabel").setVisible(true);
                            this.getView().byId("idNote").setVisible(true);
                            this.getView().byId("idNote").setEnabled(false);
                        } else {
                            this.getView().byId("setToAcceptBtn").setVisible(false);
                            this.getView().byId("setToRejectBtn").setVisible(false);
                            this.getView().byId("idNoteLabel").setVisible(false);
                            this.getView().byId("idNote").setVisible(false);
                            this.getView().byId("interactionInput").setVisible(true);
                            this.getView().byId("idLableAttach").setVisible(true);
                            this.getView().byId("fileUploader").setVisible(true);
                            this.getView().byId("uploadFileButton").setVisible(true);
                        }
					}.bind(this)
				}
			});

		},
		_onBindingChange: function() {
			var oView = this.getView(),
				oElementBinding = oView.getElementBinding();
			var isMock = this.getOwnerComponent().mockData;
			// if (!isMock || (isMock && this.mockModelLoaded)) {
			// 	this.getIncidentCategoryList();
			// }

			// No data for the binding
			if (!oElementBinding.getBoundContext()) {
				this.getRouter().getTargets().display("detailObjectNotFound");
				// if object could not be found, the selection in the master list
				// does not make sense anymore.
				this.getOwnerComponent().oListSelector.clearMasterListSelection();
				return;
			}
			var sPath = oElementBinding.getPath();
			this.getOwnerComponent().oListSelector.selectAListItem(sPath);
			this._populateDescriptionsList(sPath);
			this._populateAttachmentsList(sPath);
		},
		onNavBack: function() {
			var sPreviousHash = History.getInstance().getPreviousHash(),
				oCrossAppNavigator = sap.ushell.Container.getService("CrossApplicationNavigation");

			if (sPreviousHash !== undefined || !oCrossAppNavigator.isInitialNavigation()) {
				history.go(-1);
			} else {
				oCrossAppNavigator.toExternal({
					target: {shellHash: "#Shell-home"}
				});
			}
		},
		_populateDescriptionsList: function(sPath) {
			var list = this.getView().byId("descriptionsList");
			var descriptions = this.getModel().getObject(sPath).ServiceRequestTextCollection;
            var that1=this;
			list.removeAllItems();
			if (descriptions.forEach) {
				descriptions.sort(function(a, b) {
					return b.CreatedOn.getTime() - a.CreatedOn.getTime();
				});
				var sender, info, typeCode;
				descriptions.forEach(function(description) {
					typeCode = description.TypeCode;
					if (typeCode === "10004") {
                        // if (this.component.contactID === )
						sender = that1.getOwnerComponent().name;
						info = "Description";
					} else if (typeCode === "10008") {
                        if (that1.getOwnerComponent().contactID === description.AuthorID) {
                           sender = that1.getOwnerComponent().name; 
                        } else {
                        sender = description.CreatedBy;
                        }
						info = "Reply from Customer";
					} else if (typeCode === "10007" || typeCode === '10011') {
						sender = "Service Agent";
						info = "Reply to Customer";
					} else if (typeCode === "10008") {
						sender = that1.getOwnerComponent().name;
						info = "Reply from Customer";
					}
					list.addItem(new FeedListItem({
						showIcon: false,
						sender: sender,
						text: description.Text,
						info: info,
						timestamp: description.CreatedOn.toLocaleString()
					}));
				});
			}
		},
		_populateAttachmentsList: function(sPath) {
			var oView = this.getView();
			var list = oView.byId("attachmentsList");
            var attachments = this.getModel().getObject(sPath).ServiceRequestAttachmentFolder;
            var attchItem = attachments.filter(function (attachment) {
								return attachment.TypeCode === "ZA1";
							});
            for(var i = 0; i < attchItem.length; i++) {
                var split = attchItem[i].Name.split(",");
                if(split.length > 1) {
                    attchItem[i].Name = split[1];
                    attchItem[i].CreatedBy = split[0];
                }
            }
			var attachmentModel = new JSONModel(attchItem);
			oView.setModel(attachmentModel, "AttachmentModel");
			oView.getModel("AttachmentModel").refresh();
            if(list) {            
			var listItems = list.getItems(),
				mockData = this.getOwnerComponent().mockData;
			for (var i = 0; i < listItems.length; i++) {
				listItems[i].data("uri", mockData ? (attachments[i].__metadata ? attachments[i].__metadata.uri + "/Binary/$value" : attachments[i]) : attachments[i].__metadata.uri + "/Binary/$value");
			}
        }
			this.app.setBusy(false);
		},
		_onMetadataLoaded: function() {
			// Store original busy indicator delay for the detail view
			var iOriginalViewBusyDelay = this.getView().getBusyIndicatorDelay(),
				oViewModel = this.getModel("detailView");

			// Make sure busy indicator is displayed immediately when
			// detail view is displayed for the first time
			oViewModel.setProperty("/delay", 0);

			// Binding the view will set it to not busy - so the view is always busy if it is not bound
			oViewModel.setProperty("/busy", true);
			// Restore original busy indicator delay for the detail view
			oViewModel.setProperty("/delay", iOriginalViewBusyDelay);
        },
        onSetToAccept: function () {
			if (!this.oApproveDialog) {
				this.oApproveDialog = new Dialog({
					type: DialogType.Message,
					title: "Confirm",
					content: new Text({ text: "Once the ticket is Closed, no changes will be allowed" }),
					beginButton: new Button({
						type: ButtonType.Emphasized,
						text: "Submit",
						press: function () {
							this.onSetToAcceptStatus();
							this.oApproveDialog.close();
						}.bind(this)
					}),
					endButton: new Button({
						text: "Cancel",
						press: function () {
							this.oApproveDialog.close();
						}.bind(this)
					})
				});
			}

			this.oApproveDialog.open();
		},
        onSetToAcceptStatus: function(oEvent) {
			var patch = {ServiceRequestUserLifeCycleStatusCode: "6"},
				oModel = this.getModel(),
				oView = this.getView();
            this.app.setBusy(true);
            var that=this;
			var sPath = oView.getElementBinding().getPath(),
				url = oModel.sServiceUrl + sPath,
				token = oModel.getSecurityToken();
			jQuery.ajax({
				url: url,
				method: "PATCH",
				contentType: "application/json",
				headers: {
					"X-CSRF-TOKEN": token
				},
				data: JSON.stringify(patch),
				success: function() {
					MessageToast.show("The service request was set to Closed");
                    // that.getModel().refresh();
                    that.getView().byId("setToAcceptBtn").setVisible(false);
                    that.getView().byId("setToAcceptBtn").setVisible(false);
                    that.getView().byId("setToRejectBtn").setVisible(false);
                    that.getView().byId("idNoteLabel").setVisible(false);
                    that.getView().byId("idNote").setVisible(false);
                    that.getView().byId("interactionInput").setVisible(false);
                    that.getView().byId("idLableAttach").setVisible(false);
                    that.getView().byId("fileUploader").setVisible(false);
                    that.getView().byId("uploadFileButton").setVisible(false);
                that.getView().byId("setToRejectBtn").setVisible(false);
                that.getModel().refresh();
                    that.app.setBusy(false);
				}.bind(this),
				error: function(jqXHR) {
					var elm = jqXHR.responseXML.getElementsByTagName("message")[0];
					var error = elm.innerHTML || elm.textContent;
					MessageBox.error(error);
				},
				complete: function() {
					this.app.setBusy(false);
					this._setEditMode(false);
				}.bind(this)
			});
        },
        onSetToReject: function(oEvent) {

			var patch = {ServiceRequestUserLifeCycleStatusCode: "2"},
				oModel = this.getModel(),
				oView = this.getView();
			this.app.setBusy(true);
			var sPath = oView.getElementBinding().getPath(),
				url = oModel.sServiceUrl + sPath,
				token = oModel.getSecurityToken();
			jQuery.ajax({
				url: url,
				method: "PATCH",
				contentType: "application/json",
				headers: {
					"X-CSRF-TOKEN": token
				},
				data: JSON.stringify(patch),
				success: function() {
                    MessageToast.show("The service request was set to In Process");
                    this.onPostRejectionNotes(oEvent);
					// this.getModel().refresh();
				}.bind(this),
				error: function(jqXHR) {
					var elm = jqXHR.responseXML.getElementsByTagName("message")[0];
					var error = elm.innerHTML || elm.textContent;
					MessageBox.error(error);
				},
				complete: function() {
					this.app.setBusy(false);
					this._setEditMode(false);
				}.bind(this)
			});
        },
        onSubmitRejectPress: function () {
			if (!this.oSubmitDialog) {
				this.oSubmitDialog = new Dialog({
					type: DialogType.Message,
					title: "Confirm",
					content: [
						new Label({
							text: "Please provide the Rejection Note",
							labelFor: "submissionNote"
						}),
						new TextArea("submissionNote", {
							width: "100%",
							placeholder: "Add note (required)",
							liveChange: function (oEvent) {
								var sText = oEvent.getParameter("value");
								this.oSubmitDialog.getBeginButton().setEnabled(sText.length > 0);
							}.bind(this)
						})
					],
					beginButton: new Button({
						type: ButtonType.Emphasized,
						text: "Submit",
						enabled: false,
						press: function () {
							var sText = Core.byId("submissionNote").getValue();
                            // MessageToast.show("Note is: " + sText);
                            this.onSetToReject(sText);
                            // this.onPostRejectionNotes(sText);
							this.oSubmitDialog.close();
						}.bind(this)
					}),
					endButton: new Button({
						text: "Cancel",
						press: function () {
							this.oSubmitDialog.close();
						}.bind(this)
					})
				});
			}

			this.oSubmitDialog.open();
        },
        onPostRejectionNotes: function(onote) {
			var view = this.getView(),
				model = view.getModel(),
				sPath = view.getElementBinding().getPath(),
				authorUUID = this.getOwnerComponent().contactUUID,
				text = onote;
			
				var url = model.sServiceUrl + sPath + "/ServiceRequestTextCollection",
					token = model.getSecurityToken();
				// this.app.setBusy(true);
				jQuery.ajax({
					url: url,
					method: "POST",
					contentType: "application/json",
					headers: {
						"X-CSRF-TOKEN": token
					},
					data: JSON.stringify({
						TypeCode: "10008",
						AuthorUUID: authorUUID,
						Text: text
					}),
					success: function() {
                        this.getModel().refresh();
                        this.getView().byId("setToAcceptBtn").setVisible(false);
                        this.getView().byId("setToRejectBtn").setVisible(false);
                        // this.app.setBusy(true);
					}.bind(this),
					error: function(jqXHR) {
						var error = jqXHR.responseJSON.error.message.value;
                        MessageBox.error(error);
                        this.app.setBusy(true);
					},
					complete: function() {
						this.app.setBusy(false);
					}.bind(this)
				});
        },
        onOpeningFile: function (oEvent) {
			var url;
			//Get the file size to understand item is a LINK or FILE
			var sFileSize = oEvent.getSource().getAllAttributes()[2].getText();
			if (sFileSize === "") { //Indicates LINK
                url = oEvent.getSource().getUrl();
                // var spath = oEvent.oSource.oBindingContexts.AttachmentModel.sPath
                var oContextPath = oEvent.oSource.oBindingContexts.AttachmentModel.sPath;
			var aPathParts = oContextPath.split("/");
			var iIndex = aPathParts[aPathParts.length - 1]; //Index to delete into our array of objects
			// var dealitem;
			var attachModel = this.getView().getModel("AttachmentModel");
			var attachArray = attachModel.getData();
			url = attachArray[iIndex].DocumentLink;
                // url = "https://my342860.crm.ondemand.com/sap/c4c/odata/v1/c4codataapi/ServiceRequestCollection('00163EAA3CFC1EEC809AB907237E7AB0')/ServiceRequestAttachmentFolder('00163EAA47B51EEC81A04542525CB2BD')/Binary/$value";

			} else {
				url = "/DocumentUploader_api/downloadFile?documentId=" + oEvent.getSource().getDocumentId() + "&documentName=" + oEvent.getSource()
					.getFileName();
			}
			var win = window.open(url, '_blank');
			win.focus();
        },

	});

});