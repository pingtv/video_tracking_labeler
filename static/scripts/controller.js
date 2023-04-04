let controller = {

    data: {
        config: null,
        object_data: null,
        selected_object: null,
    },
    uiElements: {
        btn_next: $("#btn_next"),
        btn_prev: $("#btn_prev"),
        img_frame: $("#img_frame"),
        info_label: $("#LabelInfoValue"),
        input_form: $("#ModalInputForm"),
        info_dialog: $("#ModalInfo"),
        btn_save_changes: $("#SaveChanges"),
        lbl_labelvalue: $("#LableValue")

    },
    init: function (config) {
        this.data.config = config;
        this.wireEvents();
    },
    wireEvents: function () {

        let that = this;

        // call wait dialog and extract frames from videos
        {
            let waitdlg = new WaitDialog("WaitDialog", "Processing Videos", "0%");
            waitdlg.show();
            // create a timer called every second
            let timer = setInterval(function () {

                $.ajax({
                    url: '/extract_status',
                    type: "GET",
                    success: function (data) {
                        if (data['status'] === 'done') {

                            clearInterval(timer);

                            $.ajax({
                                url: '/next',
                                type: "GET",
                                data: {
                                    direction: 'current'
                                },
                                success: function (data) {
                                    if (data.hasOwnProperty('image_data')) {
                                        that.uiElements.img_frame.attr("src", "data:image/jpeg;base64," + data['image_data']);
                                        that.data.object_data = data['object_data']
                                        waitdlg.hide();
                                    }
                                },
                                error: function (jqxhr, textStatus, error) {
                                    console.log("Error: " + error);
                                }
                            });

                        } else if (data['status'] === 'processing frames') {
                            // update the wait dialog
                            waitdlg.set_message(Math.round(data['progress'] * 100) + "%");
                        }
                    },
                    error: function (jqxhr, textStatus, error) {
                        waitdlg.set_message('Error: ' + error);
                    }
                });
                // if the wait dialog is closed, stop the timer
                if (waitdlg.closed) {
                    clearInterval(timer);
                }
            }, 200);

        }
        // ----- save your changes
        $('#SaveChanges').click(function (e) {
            e.preventDefault();


            if ($("#WaitDialog").is(':visible')) {
                return;
            }

            if (that.data.selected_object === null) {
                console.log('Error: this should not happen');
                return;
            }

            let selected = that.data.selected_object;
            that.data.selected_object = null;

            // Update html of LabelToUpdate
            let newLabel = $('#LableValue').val();

            if (that.uiElements.input_form.attr('data-oldlabel') !== newLabel) {
                // update data
                console.log('new value: ' + newLabel);

                $.ajax({
                    url: '/save',
                    type: "POST",
                    data: JSON.stringify({
                        'old_value': selected['classifications'][0]['answer']['value'],
                        'new_value': newLabel
                    }),
                    dataType: "json",
                    contentType: "application/json; charset=utf-8",
                    success: function (data) {
                        if (data.hasOwnProperty('error')) {
                            that.uiElements.info_label.val('Error updating: ' + data['error']);
                            that.uiElements.info_dialog.modal('show');
                        } else {
                            if (data.hasOwnProperty('image_data')) {
                                that.uiElements.img_frame.attr("src", "data:image/jpeg;base64," + data['image_data']);
                                that.data.object_data = data['object_data']
                            } else {
                                that.uiElements.info_label.val('Error updating: no image data');
                                that.uiElements.info_dialog.modal('show');
                            }
                            that.uiElements.info_label.val('Update Successful');
                            that.uiElements.info_dialog.modal('show');
                        }
                    },
                    error: function (jqxhr, textStatus, error) {
                        that.uiElements.info_label.val('Error: ' + error);
                        that.uiElements.info_dialog.modal('show');
                        console.log('Error: ' + error);
                    }
                });

            }

            that.uiElements.input_form.modal('hide');
        });
        // --- handle arrow keys ----
        $(document).keydown(function (e) {

            if (that.uiElements.input_form.is(':visible')) {
                return;
            }


            if ($("#WaitDialog").is(':visible')) {
                return;
            }

            let code = e.keyCode || e.which;
            let direction = 'none'
            if (code === 39) { // right arrow
                direction = 'next';
            } else if (code === 37) { // left arrow
                direction = 'prev';
            } else {
                return;
            }

            // ajax get call to /next_frame sending direction

            $.ajax({
                url: '/next',
                type: "GET",
                data: {
                    direction: direction
                },
                success: function (data) {
                    if (data.hasOwnProperty('image_data')) {
                        that.uiElements.img_frame.attr("src", "data:image/jpeg;base64," + data['image_data']);
                        that.data.object_data = data['object_data']
                    }
                },
                error: function (jqxhr, textStatus, error) {
                    console.log("Error: " + error);
                }
            });


        });
        // --- handle image click -----
        that.uiElements.img_frame.click(function (e) {

            if (that.uiElements.input_form.is(':visible')) {
                return;
            }

            if ($("#WaitDialog").is(':visible')) {
                return;
            }

            var realWidth = this.naturalWidth;
            var realHeight = this.naturalHeight;

            var x = e.pageX - this.offsetLeft;
            var y = e.pageY - this.offsetTop;

            let orig_x = Math.round(x * realWidth / this.width);
            let orig_y = Math.round(y * realHeight / this.height);

            // iterate over all objects and see if click is within bbox
            if (that.data.hasOwnProperty('object_data')) {
                let objects = that.data.object_data.objects
                for (let i = 0; i < objects.length; i++) {
                    let obj = objects[i];
                    let bbox = obj.bbox;
                    if (orig_x >= bbox.left && orig_x <= bbox.left + bbox.width && orig_y >= bbox.top && orig_y <= bbox.top + bbox.height) {
                        that.data.selected_object = obj;
                        let label = obj['classifications'][0]['answer']['value'];
                        that.uiElements.lbl_labelvalue.val(label);
                        that.uiElements.input_form.attr('data-oldlabel', label);
                        that.uiElements.input_form.modal('show');
                        break;
                    }
                }
            }


        });

    }
};

