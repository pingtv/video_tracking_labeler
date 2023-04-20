let controller = {

    data: {
        config: null,
        object_data: null,
        selected_object: null,
    },
    zoomScale: 1,
    dragStartX: 0,
    dragStartY: 0,
    uiElements: {
        btn_next: $("#btn_next"),
        btn_prev: $("#btn_prev"),
        img_container: $("#img_container"),
        img_frame: $("#img_frame"),
        frameNumber: $("#frameNumber"),
        info_label: $("#LabelInfoValue"),
        input_form: $("#ModalInputForm"),
        info_dialog: $("#ModalInfo"),
        btn_save_changes: $("#SaveChanges"),
        lbl_labelvalue: $("#LabelValue")

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
                                url: '/current',
                                type: "GET",
                                success: function (data) {
                                    if (data.hasOwnProperty('image_data')) {
                                        that.uiElements.img_frame.attr("src", "data:image/jpeg;base64," + data['image_data']);
                                        that.uiElements.frameNumber.attr("value", data['object_data']['frameNumber']);
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
            let newLabel = $('#LabelValue').val();

            if (that.uiElements.input_form.attr('data-oldlabel') !== newLabel) {
                // update data
                console.log('new value: ' + newLabel);

                $.ajax({
                    url: '/save',
                    type: "POST",
                    data: JSON.stringify({
                        'old_value': that.uiElements.input_form.attr('data-oldlabel'),
                        'new_value': newLabel,
                        'selected_object': selected,
                        'frame_data': that.data.object_data
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
                                that.uiElements.frameNumber.attr("value", data['object_data']['frameNumber']);
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

            let frameNumberInput = that.uiElements.frameNumber;
            let currentFrameNum = parseInt(frameNumberInput.val(), 10);
            let newFrameNum;

            let code = e.keyCode || e.which;
            if (code === 39) { // Right arrow key
                newFrameNum = currentFrameNum + 1;
            } else if (code === 37) { // Left arrow key
                newFrameNum = currentFrameNum - 1;
            } else {
                return;
            }

            frameNumberInput.val(newFrameNum);

            // Now you need to update the displayed frame as well, you can call updateFrame() here:
            that.updateFrame();

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

            var imgOffset = $(this).offset();
            var x = e.pageX - imgOffset.left;
            var y = e.pageY - imgOffset.top;

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
                        if (obj['classifications'].length === 0) {
                            // let label = obj['classifications'][0]['answer']['value'];
                            // that.uiElements.lbl_labelvalue.val(label);
                            that.uiElements.input_form.attr('data-oldlabel', "");
                            that.uiElements.input_form.modal('show');
                            break;
                        } else {
                            let label = obj['classifications'][0]['answer']['value'];
                            that.uiElements.lbl_labelvalue.val(label);
                            that.uiElements.input_form.attr('data-oldlabel', label);
                            that.uiElements.input_form.modal('show');
                            break;
                        }
                    }
                }
            }


        });

        // --- handle frame number change ----
        this.uiElements.frameNumber.on('change', function() {
            that.updateFrame();
        });        

        // Make sure enter doesn't reload the page
        this.uiElements.frameNumber.on('keydown', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                $(this).trigger('change');
            }
        });

        // --- handle zoom ----
        that.uiElements.img_container.on('wheel', function (event) { that.handleZoom(event); });

        // --- handle drag ----
        that.uiElements.img_frame.on('mousedown', function (e) {
            e.preventDefault();
            that.dragStartX = e.pageX;
            that.dragStartY = e.pageY;
            $(document).on('mousemove', function (e) {
                that.handleDrag(e);
            });
        });
        $(document).on('mouseup', function (e) {
            $(document).off('mousemove');
        });
        
        
    },

    handleDrag: function (event) {
        event.preventDefault();
    
        let imgFrame = this.uiElements.img_frame;
        let deltaX = event.pageX - this.dragStartX;
        let deltaY = event.pageY - this.dragStartY;
    
        let currentLeft = parseFloat(imgFrame.css('left'));
        let currentTop = parseFloat(imgFrame.css('top'));

        if (isNaN(currentLeft)) {
            currentLeft = 0;
        }
        if (isNaN(currentTop)) {
            currentTop = 0;
        }
    
        imgFrame.css({
            'left': currentLeft + deltaX,
            'top': currentTop + deltaY,
        });
    
        this.dragStartX = event.pageX;
        this.dragStartY = event.pageY;
    },    

    handleZoom: function (event) {
        event.preventDefault();
        
        let scaleAmount = 0.1;
        let imgFrame = this.uiElements.img_frame;
        
        let scaleMultiplier = event.originalEvent.deltaY > 0 ? 1 - scaleAmount : 1 + scaleAmount;
        
        let currentWidth = imgFrame.width();
        let currentHeight = imgFrame.height();
        
        let newWidth = currentWidth * scaleMultiplier;
        let newHeight = currentHeight * scaleMultiplier;
        
        imgFrame.width(newWidth);
        imgFrame.height(newHeight);

        // Update the zoomScale
        this.zoomScale *= scaleMultiplier;
    },

    updateFrame: function() {
        let frameNumber = this.uiElements.frameNumber.val();
        let that = this;
        $.ajax({
            url: '/update_frame',
            type: 'POST',
            data: {'frame_number': frameNumber},
            success: function(data) {
                if (data.hasOwnProperty('image_data')) {
                    that.uiElements.img_frame.attr("src", "data:image/jpeg;base64," + data['image_data']);
                    that.uiElements.frameNumber.attr("value", data['object_data']['frameNumber']);
                    that.data.object_data = data['object_data']
                }
            },
            error: function(error) {
                console.log("Error: " + error);
            }
        });
    }
};