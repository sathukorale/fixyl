import {
    CloseOutlined, MinusCircleOutlined, PlusOutlined,
    SendOutlined, StarOutlined, DownOutlined, UpOutlined
} from '@ant-design/icons';
import { LogoutOutlined, RollbackOutlined } from '@ant-design/icons';
import { Form, Input, Button, Popover } from 'antd';
import moment from 'moment';
import React, { useRef } from 'react';
import { IgnorableInput } from 'src/common/IgnorableInput/IgnorableInput';
import { Toast } from 'src/common/Toast/Toast';
import { FixComplexType, FixField } from 'src/services/fix/FixDefs';
import { FixMessage, FixSession } from 'src/services/fix/FixSession';
import { GlobalServiceRegistry } from 'src/services/GlobalServiceRegistry';
import { LM } from 'src/translations/language-manager';
import "./FixForm.scss";

const Mark = require("mark.js");

const getIntlMessage = (msg: string, options?: any) => {
    return LM.getMessage(`fix_form.${msg}`, options);
}

const SaveAsForm = ({ togglePopover, onAddToFavorites, name }: {
    togglePopover: (state: boolean) => void,
    onAddToFavorites: (data: any) => void,
    name?: string
}) => {
    const formRef: any = useRef(null);

    const checkFormHasErrors = (): boolean => {
        const fields = formRef.current?.getFieldsError() ?? [];

        for (let i = 0; i < fields.length; i++) {
            const field = fields[i];
            if (field.errors.length > 0) {
                return true;
            }
        }

        return false;
    }

    return (<div className="save-as-form-container">
        <div className="header">
            <div className="close" onClick={() => togglePopover(false)}>✕</div>
        </div>
        <Form ref={formRef} layout="vertical" initialValues={{ name }} className="save-as-form"
            onFinish={(values) => {
                onAddToFavorites(values)
            }}>
            <div className="form-item-container">
                <Form.Item name="name" rules={[{
                    required: true,
                }]} label={getIntlMessage("name")}>
                    <Input />
                </Form.Item>
            </div>
            <div style={{ textAlign: "center" }}>
                <Button className="button-v2" type="primary" style={{ marginLeft: "auto" }}
                    htmlType="submit" onClick={() => {
                        setTimeout(() => {
                            if (!checkFormHasErrors()) {
                                togglePopover(false)
                            }
                        }, 10)
                    }}>
                    {getIntlMessage("save").toUpperCase()}
                </Button>
            </div>
        </Form>
    </div>);
}

interface FixFormProps {
    message: FixMessage;
    session: FixSession;
    hideTitle?: boolean;
    removeNonFilledFields?: boolean;
    value?: any;
    disabled?: boolean;
    viewOnly?: boolean;
    onSend?: (data: any) => void;
    name?: string;
    saveMode?: boolean;
    enableIgnore?: boolean;
    preferredFavName?: string;
}

interface FixFormState {
    initialized: boolean;
    saving: boolean;
    confirmVisible: boolean;
    searchText?: string;
    markedItems: any[];
    currentMarkedIndex?: any;
}

export class FixForm extends React.Component<FixFormProps, FixFormState> {
    fieldIterationIndex = 0;
    private formRef: any = React.createRef();
    private searchFormRef: any = React.createRef();
    private markInstance: any;
    private martkUpdateTimeout: any;

    constructor(props: any) {
        super(props)
        this.state = {
            initialized: true,
            saving: false,
            confirmVisible: false,
            markedItems: []
        }
    }

    componentDidUpdate(prevProp: FixFormProps) {
        if (prevProp.message !== this.props.message || prevProp.value !== this.props.value) {
            this.setState({ initialized: false })

            setTimeout(() => {
                this.setState({ initialized: true })
            }, 10)
        }
    }

    private getFieldValues = (def: FixMessage, inputData: any, namePrefix: string, fieldIterationIndex: number) => {
        const ret: any = {};
        const properties = Object.keys(inputData)
        def.fields.forEach(field => {
            const name = field.def.name;
            const filteredProperties = properties.filter(property => property.indexOf(`${namePrefix}__${name}__${fieldIterationIndex}`) > -1)
            filteredProperties.forEach(property => {
                let value = inputData[property]
                switch (field.def.type.toLowerCase()) {
                    case "utctimestamp":
                    case 'monthyear':
                    case 'utcdateonly':
                    case 'utctimeonly':
                        if (typeof value === "object") {
                            value = value?.toISOString();
                        }
                        break;
                }

                ret[name] = value
            })
        })

        return ret;
    }

    private getGroupValues = (def: FixMessage, inputData: any, namePrefix: string) => {
        const ret: any = [];
        (def.groupInstances[namePrefix] as any[])?.forEach((inst: any, index) => {
            const fieldData = this.getFieldValues(def, inputData, `${namePrefix}|G:${def.name}:${index}`, index)
            let groupData: any = {};
            def.groups.forEach(group => {
                groupData[group.name] = this.getGroupValues(group, inputData, `${namePrefix}|G:${def.name}:${index}`);
            })

            let componentData: any = {};
            def.components.forEach(comp => {
                componentData[comp.name] = this.getComponentValues(comp, inputData, `${namePrefix}|G:${def.name}:${index}`);
            })

            ret.push({ ...fieldData, ...groupData, ...componentData })
        })


        return ret;
    }

    private getComponentValues = (def: FixMessage, inputData: any, namePrefix: string) => {
        const fieldData = this.getFieldValues(def, inputData, `${namePrefix}|C:${def.name}:0`, 0)
        let groupData: any = {};
        def.groups.forEach(group => {
            groupData[group.name] = this.getGroupValues(group, inputData, `${namePrefix}|C:${def.name}:0`);
        })

        let componentData: any = {};
        def.components.forEach(comp => {
            componentData[comp.name] = this.getComponentValues(comp, inputData, `${namePrefix}|C:${def.name}:0`);
        })

        return { ...fieldData, ...groupData, ...componentData };
    }

    private getMessageData = (data: any) => {
        const { message } = this.props;
        const fieldData = this.getFieldValues(message, data, "root", 0)
        let groupData: any = {};
        message.groups.forEach(group => {
            groupData[group.name] = this.getGroupValues(group, data, "root")
        })

        let componentData: any = {};
        message.components.forEach(comp => {
            componentData[comp.name] = this.getComponentValues(comp, data, "root")
        })

        return { ...fieldData, ...groupData, ...componentData };
    }

    onFinished = (data: any) => {
        const { onSend } = this.props;
        const ret = this.getMessageData(data);

        onSend?.(ret);
    }

    private onAddToFavorites = (name: string) => {
        const { session, message } = this.props;
        const data = this.formRef.current?.getFieldsValue();
        const ret = this.getMessageData(data);
        this.setState({ saving: true })

        GlobalServiceRegistry.favoriteManager.addToFavorites(session.profile, message, name, ret).then(() => {
            this.setState({ saving: false })
            Toast.success(getIntlMessage("msg_saving_success_title"), getIntlMessage("msg_saving_success", { name }))
        }).catch(error => {
            this.setState({ saving: false })
            console.log('Saving failed', error);
            Toast.error(getIntlMessage("msg_saving_failed_title"), getIntlMessage("msg_saving_failed"))
        });
    }

    private getValue = (field: FixField, inputData: any) => {
        if (!inputData) {
            return undefined;
        }

        const name = field.def.name;
        const value = inputData[name];
        if (!value) {
            return undefined;
        }

        switch (field.def.type.toLowerCase()) {
            case "utctimestamp":
            case "monthyear":
            case "utcdateonly":
            case "utctimeonly":
                return moment(value);
            default:
                return value;
        }
    }

    private createFieldValues = (def: FixMessage, inputData: any, namePrefix: string, fieldIterationIndex: number) => {
        const ret: any = {};
        def.fields.forEach(field => {
            const name = field.def.name;
            ret[`${namePrefix}__${name}__${fieldIterationIndex}`] = this.getValue(field, inputData)
        })

        return ret;
    }

    private createGroupValues = (def: FixMessage, inputData: any, namePrefix: string) => {
        let ret: any = {};
        inputData?.forEach((inst: any, index: number) => {
            const groupName = `${namePrefix}|G:${def.name}:${index}`;

            const fieldData = this.createFieldValues(def, inst, groupName, index)
            let groupData: any = {};
            def.groups.forEach(group => {
                groupData = { ...groupData, ...this.createGroupValues(group, inst?.[group.name], groupName) };
            })

            let componentData: any = {};
            def.components.forEach(comp => {
                componentData = { ...componentData, ...this.createComponentValues(comp, inst?.[comp.name], groupName) };
            })

            ret = { ...ret, ...fieldData, ...groupData, ...componentData }
        });

        var ignorable = this.props.enableIgnore ?? false;
        def.groupInstances[namePrefix] = def.groupInstances[namePrefix] ?? (ignorable ? "{ignore}" : (inputData ? inputData.map(() => ({})) : []));

        return ret;
    }

    private createComponentValues = (def: FixMessage, inputData: any, namePrefix: string) => {
        const fieldData = this.createFieldValues(def, inputData, `${namePrefix}|C:${def.name}:0`, 0)
        let groupData: any = {};
        def.groups.forEach(group => {
            groupData = { ...groupData, ...this.createGroupValues(group, inputData?.[group.name], `${namePrefix}|C:${def.name}:0`) };
        })

        let componentData: any = {};
        def.components.forEach(comp => {
            componentData = { ...componentData, ...this.createComponentValues(comp, inputData?.[comp.name], `${namePrefix}|C:${def.name}:0`) };
        })

        return { ...fieldData, ...groupData, ...componentData };
    }

    private createFormData = (data: any) => {
        const { message } = this.props;
        const fieldData = this.createFieldValues(message, data, "root", 0)
        let groupData: any = {};
        message.groups.forEach(group => {
            groupData = { ...groupData, ...this.createGroupValues(group, data[group.name], `root`) }
        })

        let componentData: any = {};
        message.components.forEach(comp => {
            componentData = { ...componentData, ...this.createComponentValues(comp, data[comp.name], "root") }
        })

        return { ...fieldData, ...groupData, ...componentData };
    }

    private getInitialValues() {
        const { session, value } = this.props;
        const { hbInterval, password } = session.profile;
        if (value) {
            return this.createFormData(value);
        }

        return {
            root__HeartBtInt__0: hbInterval,
            root__Password__0: password
        };
    }

    private togglePopover = (state: boolean) => {
        this.setState({ confirmVisible: state })
    }

    private getFieldRender = (fieldName: string, field: FixField, required: boolean, parent: string, fieldIterationIndex: number) => {
        const { enableIgnore } = this.props;
        return <IgnorableInput fieldId={fieldName} enableIgnore={enableIgnore} componentProps={{ field, required, parent, fieldIterationIndex }} />
    }

    renderField = (field: FixField, level: number, fieldIterationIndex: number, parent: string, isParentRequired: boolean) => {
        const { def } = field;
        const fieldName = `${parent}__${def.name}__${fieldIterationIndex}`;

        if (this.props.removeNonFilledFields) {
            const initialValues = this.getInitialValues();
            if (initialValues[fieldName] === undefined) {
                return null
            }
        }

        const isRequired = isParentRequired && (field.required || false);
        const isChildRequiredButParentNot = !isParentRequired && (field.required || false);

        return <div className="fix-field-wrapper" style={{ marginLeft: level * 10 }}>
            {<Form.Item 
                name={fieldName}
                key={fieldName}
                id={fieldName}
                label={
                    <span className={ isChildRequiredButParentNot ? 'fix-optional-field' : undefined } 
                          title={ isChildRequiredButParentNot ? "This field is marked required, but the parent component/group is optional." : undefined }>
                        {def.name}
                        <span className="field-number">[{def.number}]</span>
                    </span>
                }
                rules={[{ required: isRequired, message: 'Please input valid value!' }]} 
            >
                {
                    this.getFieldRender(fieldName, field, isRequired, parent, fieldIterationIndex)
                }
            </Form.Item>}
        </div>
    }

    renderGroups = (group: FixComplexType, level: number, parent: string, isParentRequired: boolean) => {
        const newLevel = level++;
        if (!group.groupInstances[parent] && !(this.props.enableIgnore || false)) {
            if (group.required) {
                group.groupInstances[parent] = [{}];
            } else {
                group.groupInstances[parent] = [];
            }
        }

        const remove = (index: number) => {
            const array = group.groupInstances[parent];
            array.splice(index, 1);
            group.groupInstances[parent] = [...array];
            this.forceUpdate();
        }

        const isRequired = isParentRequired && (group.required || false);
        const isIgnored = group.groupInstances[parent] === "{ignore}";

        return <div className="fix-group" style={{ marginLeft: level * 10 }}>
            <div className="fix-group-title">{getIntlMessage("group", { type: `${group.name} [${group.id}]` })}
                &nbsp;&nbsp;&nbsp;&nbsp;
                {
                    (this.props.enableIgnore ?? false) && (
                        (!isIgnored) 
                        ? 
                        <div onClick={() => {
                            group.groupInstances[parent] = "{ignore}";
                            this.forceUpdate(); 
                        }} className="ignore-btn"><LogoutOutlined color='white' /></div>
                        :
                        <div onClick={() => {
                            group.groupInstances[parent] = [];
                            this.forceUpdate();
                        }} className="ignore-btn"><RollbackOutlined color='white' />&nbsp;&nbsp;&lt;-- Field Ignored --&gt;</div>
                    )
                }
                
                <div className="fix-group-insert" onClick={() => {
                    if (isIgnored || !group.groupInstances[parent])
                        group.groupInstances[parent] = [];
                    group.groupInstances[parent].push({})
                    this.forceUpdate();
                }}><PlusOutlined /></div></div>
            {(!isIgnored) && <div className="fix-group-fields">
                {
                (group.groupInstances[parent] as any[])?.map((val, i) => {
                    return <div className="repitition-block" key={i}>
                        <div className="repitition-block-content">
                            {this.renderFormFields(group, newLevel, i, `${parent}|G:${group.name}:${i}`, isRequired)}
                        </div>
                        <MinusCircleOutlined
                            className="dynamic-delete-button"
                            onClick={() => remove(i)}
                        />
                    </div>
                })}
            </div>
            }
        </div>
    }

    renderComponents = (component: FixComplexType, level: number, parent: string, isParentRequired: boolean) => {
        const newLevel = level++;
        const isRequired = isParentRequired && (component.required || false);        
        const isChildRequiredButParentNot = !isParentRequired && (component.required || false);

        return <div className="fix-component" style={{ marginLeft: level * 10 }} key={component.name + newLevel}>
            <div title={ isChildRequiredButParentNot ? "This field is marked required, but the parent component/group is optional." : undefined }
                 className={
                     "fix-component-title" + (isChildRequiredButParentNot ? ' fix-optional-component' : "")
                 }>
                    {getIntlMessage("component", { type: component.name })}
                    {
                        (!isRequired) && 
                        <span className="fix-optional-component" title='This item is marked optional, thus all required fields under it will be treated as optional as well.'> (Optional)</span>
                    }
            </div>
            <div className="fix-component-fields">
                {this.renderFormFields(component, newLevel, 0, `${parent}|C:${component.name}:0`, isRequired)}
            </div>
        </div>
    }

    private renderFormFields = (message: FixComplexType, level: number, fieldIterationIndex: number, parent: string, isParentRequired: boolean = true) => {
        return message.getFieldOrder().map(inst => {
            switch (inst.type) {
                case "field":
                    const field = message.fields.get(inst.name);
                    return field && this.renderField(field, level, fieldIterationIndex, parent, isParentRequired)
                case "component":
                    const comp = message.components.get(inst.name);
                    return comp && this.renderComponents(comp, level, parent, isParentRequired)
                case "group":
                    const group = message.groups.get(inst.name);
                    return group && this.renderGroups(group, level, parent, isParentRequired)
                default:
                    return null;
            }
        })
    }

    private renderSearchForm = () => {
        const { name } = this.props;
        const { currentMarkedIndex, markedItems } = this.state;

        return <div className="search-wrapper">
            <Form ref={this.searchFormRef} scrollToFirstError={true}>
                <Form.Item name="search">
                    <Input placeholder={getIntlMessage("search")} onChange={(e) => {
                        this.setState({ searchText: e.target.value, markedItems: [], currentMarkedIndex: undefined }, () => {
                            clearTimeout(this.martkUpdateTimeout);
                            const itemArray: any[] = [];

                            this.markInstance = new Mark(document.querySelector(`#search-node${name}`));
                            this.markInstance.unmark({
                                done: () => {
                                    this.markInstance.mark(this.state.searchText, {
                                        each: (data: any) => {
                                            clearTimeout(this.martkUpdateTimeout);
                                            itemArray.push(data);

                                            this.martkUpdateTimeout = setTimeout(() => {
                                                let currentMarkedIndex = undefined;
                                                if (itemArray.length > 0) {
                                                    currentMarkedIndex = 0;
                                                    itemArray[0].scrollIntoView();
                                                }

                                                this.setState({ markedItems: itemArray, currentMarkedIndex })
                                            })
                                        },
                                    });
                                }
                            });
                        });

                    }} />
                </Form.Item>
            </Form>
            {currentMarkedIndex !== undefined && <div className="search-selector">
                <DownOutlined onClick={() => {
                    const markedIndex = currentMarkedIndex + 1;
                    if (markedIndex < markedItems.length) {
                        markedItems[markedIndex]?.scrollIntoView();
                        this.setState({ currentMarkedIndex: markedIndex })
                    }
                }} />
                <UpOutlined onClick={() => {
                    const markedIndex = currentMarkedIndex - 1;
                    if (markedIndex > -1) {
                        markedItems[markedIndex]?.scrollIntoView();
                        this.setState({ currentMarkedIndex: markedIndex })
                    }
                }} />
                <span className="search-selector-text">{(currentMarkedIndex + 1)}/{markedItems.length}  </span>
            </div>}
            <CloseOutlined onClick={() => {
                this.setState({ markedItems: [], currentMarkedIndex: undefined })
                this.markInstance?.unmark();
                this.searchFormRef?.current.resetFields();
            }} />
        </div>
    }

    render() {
        const { hideTitle, message, viewOnly, disabled, name, saveMode, preferredFavName } = this.props;
        const { initialized, confirmVisible, saving } = this.state;

        return <div className="fix-form-container">

            {!hideTitle && <div className="form-header">
                <div className="title">
                    {getIntlMessage("title", { type: message.name })}
                </div>
            </div>}
            {this.renderSearchForm()}
            {initialized && 
                <Form ref={this.formRef} 
                      layout="horizontal" 
                      initialValues={this.getInitialValues()} 
                      labelCol={{ span: 10 }} 
                      labelAlign="left" 
                      onFinish={this.onFinished}
                      scrollToFirstError={{
                        behavior: 'smooth',
                        block: 'center',
                        inline: 'center',
                      }}>
                    <div className="form-body" id={`search-node${name}`}>
                        {this.renderFormFields(message, 0, 0, "root")}
                    </div>
                    {!viewOnly && <div className="form-footer">
                        {!saveMode && <React.Fragment>
                            <Popover
                                content={<SaveAsForm togglePopover={this.togglePopover} name={preferredFavName}
                                    onAddToFavorites={(data) => { this.onAddToFavorites(data.name); }} />}
                                title={getIntlMessage("save_as").toUpperCase()}
                                placement="top"
                                visible={confirmVisible}
                            >
                                <Button type="ghost" loading={saving} icon={<StarOutlined />} onClick={() => this.togglePopover(true)}>{getIntlMessage("add_to_fav")}</Button>
                            </Popover>

                            <Button disabled={disabled} htmlType="submit" type="primary" icon={<SendOutlined />}>{getIntlMessage("send")}</Button>
                        </React.Fragment>}
                        {saveMode && <Button disabled={disabled} htmlType="submit" type="primary" className="save-btn" icon={<SendOutlined />}>{getIntlMessage("save")}</Button>}
                    </div>}
            </Form>}
        </div>

    }

}
