// Copyright (c) 2016, Frappe Technologies and contributors
// For license information, please see license.txt

frappe.ui.form.on("Auto Email Report", {
	refresh: function (frm) {
		frm.trigger("fetch_report_filters");
		if (!frm.is_new()) {
			frm.add_custom_button(__("Download"), function () {
				var w = window.open(
					frappe.urllib.get_full_url(
						"/api/method/frappe.email.doctype.auto_email_report.auto_email_report.download?" +
							"name=" +
							encodeURIComponent(frm.doc.name)
					)
				);
				if (!w) {
					frappe.msgprint(__("Please enable pop-ups"));
					return;
				}
			});
			frm.add_custom_button(__("Send Now"), function () {
				frappe.call({
					method: "frappe.email.doctype.auto_email_report.auto_email_report.send_now",
					args: { name: frm.doc.name },
					callback: function () {
						frappe.msgprint(__("Scheduled to send"));
					},
				});
			});
		} else {
			if (!frm.doc.user) {
				frm.set_value("user", frappe.session.user);
			}
			if (!frm.doc.email_to) {
				frm.set_value("email_to", frappe.session.user);
			}
		}

		frm.add_custom_button(__("Get Emails"), () => show_get_emails_dialog(frm));

		frm.set_query("sender", function () {
			return {
				filters: {
					enable_outgoing: 1,
					awaiting_password: 0,
				},
			};
		});
	},
	report: function (frm) {
		frm.set_value("filters", "");
		frm.trigger("fetch_report_filters");
	},
	fetch_report_filters(frm) {
		if (
			frm.doc.report &&
			frm.doc.report_type !== "Report Builder" &&
			frm.script_setup_for !== frm.doc.report
		) {
			frappe.call({
				method: "frappe.desk.query_report.get_script",
				args: {
					report_name: frm.doc.report,
				},
				callback: function (r) {
					frappe.dom.eval(r.message.script);
					frm.script_setup_for = frm.doc.report;
					frm.trigger("show_filters");
				},
			});
		} else {
			frm.trigger("show_filters");
		}
	},
	show_filters: async function (frm) {
		if (!frm.doc.report) {
			return;
		}
		var wrapper = $(frm.get_field("filters_display").wrapper);
		wrapper.empty();
		let reference_report = frappe.query_reports[frm.doc.report];
		if (!reference_report || !reference_report.filters) {
			reference_report = await frappe.model.with_doc("Report", frm.doc.report);
		}
		if (
			frm.doc.report_type === "Custom Report" ||
			(frm.doc.report_type !== "Report Builder" &&
				reference_report &&
				reference_report.filters)
		) {
			// make a table to show filters
			var table = $(
				'<table class="table table-bordered" style="cursor:pointer; margin:0px;"><thead>\
				<tr><th style="width: 50%">' +
					__("Filter") +
					"</th><th>" +
					__("Value") +
					"</th></tr>\
				</thead><tbody></tbody></table>"
			).appendTo(wrapper);
			$('<p class="text-muted small">' + __("Click table to edit") + "</p>").appendTo(
				wrapper
			);

			var filters = {};
			var dialog;
			let report_filters;

			if (
				frm.doc.report_type === "Custom Report" &&
				reference_report &&
				reference_report.filters
			) {
				if (frm.doc.filters) {
					filters = JSON.parse(frm.doc.filters);
				} else {
					frappe.db.get_value("Report", frm.doc.report, "json", (r) => {
						if (r && r.json) {
							filters = JSON.parse(r.json).filters || {};
						}
					});
				}

				report_filters = frappe.query_reports[frm.doc.reference_report].filters;
			} else {
				filters = JSON.parse(frm.doc.filters || "{}");
				report_filters = reference_report.filters;
			}

			frm.set_value(
				"filter_meta",
				report_filters && report_filters.length > 0 ? JSON.stringify(report_filters) : ""
			);

			var report_filters_list = [];
			$.each(report_filters, function (key, val) {
				// Remove break fieldtype from the filters
				if (val.fieldtype != "Break") {
					if (val.fieldtype === "MultiSelectList") {
						val.get_data = (txt) => {
							if (!dialog || !val.options) return [];

							if (Array.isArray(val.options)) return val.options;

							const doctype_link =
								frappe.scrub(val.options) === val.options
									? dialog.get_value(val.options)
									: val.options;

							return doctype_link
								? frappe.db.get_link_options(doctype_link, txt)
								: [];
						};
					}
					report_filters_list.push(val);
				}
			});
			report_filters = report_filters_list;

			const mandatory_css = {
				"background-color": "var(--error-bg)",
				"font-weight": "bold",
			};

			report_filters.forEach((f) => {
				const css = f.reqd ? mandatory_css : {};
				const row = $("<tr></tr>").appendTo(table.find("tbody"));
				$("<td>" + f.label + "</td>").appendTo(row);
				$("<td>" + frappe.format(filters[f.fieldname], f) + "</td>")
					.css(css)
					.appendTo(row);
			});

			// remove mandatory but hidden filters from dialog
			const dialog_filter_fields = report_filters.filter(
				(f) => !(f.hidden == 1 && f.reqd == 1)
			);
			table.on("click", function () {
				dialog = new frappe.ui.Dialog({
					fields: dialog_filter_fields,
					primary_action: function () {
						var values = this.get_values();
						if (values) {
							this.hide();
							frm.set_value("filters", JSON.stringify(values));
							frm.trigger("show_filters");
						}
					},
				});
				dialog.show();

				// add filters defined in onload event of report
				if (reference_report.onload) {
					frappe.query_report = new frappe.views.QueryReport({
						filters: dialog.fields_list,
					});
					reference_report.onload(frappe.query_report);
				}

				dialog.doc = dialog.doc || {};
				dialog.fields_list.forEach((f) => (f.doc = dialog.doc));

				dialog.set_values(filters);
			});

			// populate dynamic date field selection
			let date_fields = report_filters
				.filter((df) => df.fieldtype === "Date")
				.map((df) => ({ label: df.label, value: df.fieldname }));
			frm.set_df_property("from_date_field", "options", date_fields);
			frm.set_df_property("to_date_field", "options", date_fields);
			frm.toggle_display("dynamic_report_filters_section", date_fields.length > 0);
		} else {
			frm.set_value("filter_meta", "");
		}
	},
});

function show_get_emails_dialog(frm) {
	let dialog = new frappe.ui.Dialog({
		title: __("Fetch Emails from User Filters"),
		size: "large",
		fields: [
			{
				fieldtype: "Select",
				label: __("Match"),
				options: [
					{ label: __("Match ALL filters (AND)"), value: "AND" },
					{ label: __("Match ANY filter (OR)"), value: "OR" },
				],
				default: "AND",
			},
			{
				fieldname: "filter_area",
				fieldtype: "HTML",
			},
			{ fieldname: "col_break", fieldtype: "Column Break" },
			{
				fieldname: "preview_area",
				fieldtype: "HTML",
				options: `<div class="text-muted small" style="padding-top: 6px;">
					${__("Set filters and click Preview to see matching users.")}
				</div>`,
			},
		],
		primary_action_label: __("Fetch & Add Emails"),
		primary_action: () => fetch_emails_and_apply(frm, dialog),
	});

	dialog.show();

	frappe.model.with_doctype("User", () => {
		let filter_group = new frappe.ui.FilterGroup({
			parent: dialog.get_field("filter_area").$wrapper,
			doctype: "User",
			on_change: () => {},
		});

		dialog.filter_group = filter_group;

		filter_group.add_filter?.("User", "name", "like", "");
	});

	dialog.set_secondary_action_label(__("Preview"));
	dialog.set_secondary_action(() => preview_matching_emails(dialog));
}

function get_dialog_filters(dialog) {
	if (!dialog.filter_group) return [];
	return dialog.filter_group.get_filters() || [];
}

function preview_matching_emails(dialog) {
	let filters = get_dialog_filters(dialog);
	let condition = dialog.get_value("condition") || "AND";

	if (!filters.length) {
		frappe.msgprint(
			__("Add at least one filter, or use Fetch & Add to pull all enabled users.")
		);
		return;
	}

	frappe.call({
		method: "frappe.email.doctype.auto_email_report.auto_email_report.get_filtered_user_emails",
		args: { filters: JSON.stringify(filters), condition },
		freeze: true,
		freeze_message: __("Checking matches..."),
		callback: (r) => {
			let emails = r.message || [];
			dialog.set_df_property(
				"preview_area",
				"options",
				`<div class="small" style="padding-top: 6px;">
					<strong>${emails.length}</strong> ${__("user(s) matched")}
					${
						emails.length
							? "<br>" +
							  emails.slice(0, 10).join(", ") +
							  (emails.length > 10
									? __(" …and {0} more", [emails.length - 10])
									: "")
							: ""
					}
				</div>`
			);
		},
	});
}

function fetch_emails_and_apply(frm, dialog) {
	let filters = get_dialog_filters(dialog);
	let condition = dialog.get_value("condition") || "AND";

	let do_fetch = () => {
		frappe.call({
			method: "frappe.email.doctype.auto_email_report.auto_email_report.get_filtered_user_emails",
			args: { filters: JSON.stringify(filters), condition },
			freeze: true,
			freeze_message: __("Fetching emails..."),
			callback: (r) => {
				let fetched = r.message || [];
				if (!fetched.length) {
					frappe.msgprint(__("No users matched the given filters."));
					return;
				}
				let existing = (frm.doc.email_to || "")
					.split(/[\n,]+/)
					.map((e) => e.trim())
					.filter(Boolean);
				let merged = Array.from(new Set([...existing, ...fetched]));
				frm.set_value("email_to", merged.join("\n"));
				frappe.show_alert({
					message: __("{0} email(s) added", [fetched.length]),
					indicator: "green",
				});
				dialog.hide();
			},
		});
	};

	if (!filters.length) {
		frappe.confirm(
			__("No filters are set. This will fetch ALL enabled users. Continue?"),
			do_fetch
		);
	} else {
		do_fetch();
	}
}
