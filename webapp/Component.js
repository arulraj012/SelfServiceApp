sap.ui.define([
	"sap/ui/core/UIComponent",
	"sap/ui/Device",
	"./model/models",
	"./controller/ListSelector",
	"./controller/ErrorHandler"
], function (UIComponent, Device, models, ListSelector, ErrorHandler) {
	"use strict";

	return UIComponent.extend("gfservicerequests.Component", {

		metadata : {
			manifest : "json"
        },
        contactUUID: null,
		contactID: null,
		mockData: false,
		SELECT_BOX_URLS: {
			ServiceRequestLifeCycleStatusCode: '/ServiceRequestServiceRequestLifeCycleStatusCodeCollection',
			ServicePriorityCode: '/ServiceRequestServicePriorityCodeCollection',
			ServiceCategory: '/ServiceIssueCategoryCatalogueCategoryCollection',
			IncidentCategory: '/ServiceIssueCategoryCatalogueCategoryCollection?$filter=ParentObjectID%20eq%20%27${0}%27',
			DescriptionTypeCollection: '/ServiceRequestTextCollectionTypeCodeCollection',
			ProductCategoryCollection: '/ProductCollection'
		},

		/**
		 * The component is initialized by UI5 automatically during the startup of the app and calls the init method once.
		 * In this method, the device models are set and the router is initialized.
		 * @public
		 * @override
		 */
		init : function () {

            // this.setModel(this.getOwnerComponent().getModel("custom"));
            //  var oModel = this.getOwnerComponent().getModel();
            // 	this.setModel(oModel);
            // this.portalEmail = jQuery.sap.getUriParameters().get("email");


            this.oListSelector = new ListSelector();
            this.startupParams = this.receiveStartupParams();
			this._oErrorHandler = new ErrorHandler(this);

			// set the device model
			this.setModel(models.createDeviceModel(), "device");

			// call the base component's init function and create the App view
			UIComponent.prototype.init.apply(this, arguments);

			// create the views based on the url/hash
			this.getRouter().initialize();
		},

		/**
		 * The component is destroyed by UI5 automatically.
		 * In this method, the ListSelector and ErrorHandler are destroyed.
		 * @public
		 * @override
		 */

        createIncidentCategoryFilters: function(parentObject, typeCode) {
            return [
                new sap.ui.model.Filter({
                    path: "ParentObjectID",
                    operator: sap.ui.model.FilterOperator.EQ,
                    value1: parentObject
                }),
                new sap.ui.model.Filter({
                    path: "TypeCode",
                    operator: sap.ui.model.FilterOperator.EQ,
                    value1: typeCode
                })
            ];
        },

		receiveStartupParams: function() {
			var obj = {},
				oComponentData = this.getComponentData && this.getComponentData();

			if (oComponentData && oComponentData.startupParameters) {
				var startupParameters = oComponentData.startupParameters;
				obj.createNewTicket = startupParameters.createNewTicket && startupParameters.createNewTicket[0];
				obj.highPriority = startupParameters.highPriority && startupParameters.highPriority[0];
				obj.pendingResponse = startupParameters.pendingResponse && startupParameters.pendingResponse[0];
			}

			return obj;
		},

		destroy : function () {
			this.oListSelector.destroy();
			this._oErrorHandler.destroy();
			// call the base component's destroy function
			UIComponent.prototype.destroy.apply(this, arguments);
		},

		/**
		 * This method can be called to determine whether the sapUiSizeCompact or sapUiSizeCozy
		 * design mode class should be set, which influences the size appearance of some controls.
		 * @public
		 * @return {string} css class, either 'sapUiSizeCompact' or 'sapUiSizeCozy' - or an empty string if no css class should be set
		 */
		getContentDensityClass : function() {
			if (this._sContentDensityClass === undefined) {
				// check whether FLP has already set the content density class; do nothing in this case
				// eslint-disable-next-line sap-no-proprietary-browser-api
				if (document.body.classList.contains("sapUiSizeCozy") || document.body.classList.contains("sapUiSizeCompact")) {
					this._sContentDensityClass = "";
				} else if (!Device.support.touch) { // apply "compact" mode if touch is not supported
					this._sContentDensityClass = "sapUiSizeCompact";
				} else {
					// "cozy" in case of touch support; default for most sap.m controls, but needed for desktop-first controls like sap.ui.table.Table
					this._sContentDensityClass = "sapUiSizeCozy";
				}
			}
			return this._sContentDensityClass;
        },
        onConfigChange: function(oEvent) {
			var settings = this.getMetadata().getManifest()["sap.cloud.portal"].settings;
			this.getAggregation("rootControl").$().css("height", settings.widgetHeight.value + "px");
		}

	});
});