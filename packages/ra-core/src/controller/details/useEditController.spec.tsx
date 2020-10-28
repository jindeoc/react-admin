import * as React from 'react';
import expect from 'expect';
import { act, cleanup, wait } from '@testing-library/react';

import { EditController } from './EditController';
import renderWithRedux from '../../util/renderWithRedux';
import { DataProviderContext } from '../../dataProvider';
import { DataProvider } from '../../types';
import { ResourceProvider } from '../../core';

describe('useEditController', () => {
    afterEach(cleanup);

    const initialState = {
        admin: {
            resources: {
                posts: {
                    data: {},
                    props: {
                        name: 'posts',
                        hasCreate: true,
                        hasEdit: true,
                        hasList: true,
                        hasShow: true,
                    },
                },
            },
        },
    };

    const resourceValue = {
        resource: 'posts',
    };

    const defaultProps = {
        basePath: '',
        id: 12,
        debounce: 200,
    };

    it('should call the dataProvider.getOne() function on mount', async () => {
        const getOne = jest
            .fn()
            .mockImplementationOnce(() =>
                Promise.resolve({ data: { id: 12, title: 'hello' } })
            );
        const dataProvider = ({ getOne } as unknown) as DataProvider;
        const { queryAllByText } = renderWithRedux(
            <DataProviderContext.Provider value={dataProvider}>
                <ResourceProvider value={resourceValue}>
                    <EditController {...defaultProps}>
                        {({ record }) => <div>{record && record.title}</div>}
                    </EditController>
                </ResourceProvider>
            </DataProviderContext.Provider>,
            initialState
        );
        await wait(() => {
            expect(getOne).toHaveBeenCalled();
            expect(queryAllByText('hello')).toHaveLength(1);
        });
    });

    it('should dispatch a CRUD_GET_ONE action on mount', () => {
        const dataProvider = ({
            getOne: () => Promise.resolve({ data: { id: 12, title: 'hello' } }),
        } as unknown) as DataProvider;
        const { dispatch } = renderWithRedux(
            <DataProviderContext.Provider value={dataProvider}>
                <ResourceProvider value={resourceValue}>
                    <EditController {...defaultProps}>
                        {({ record }) => <div>{record && record.title}</div>}
                    </EditController>
                </ResourceProvider>
            </DataProviderContext.Provider>,
            initialState
        );
        const crudGetOneAction = dispatch.mock.calls[0][0];
        expect(crudGetOneAction.type).toEqual('RA/CRUD_GET_ONE');
        expect(crudGetOneAction.payload).toEqual({ id: 12 });
        expect(crudGetOneAction.meta.resource).toEqual('posts');
    });

    it('should grab the record from the store based on the id', () => {
        const dataProvider = ({
            getOne: () => Promise.resolve({ data: { id: 12, title: 'world' } }),
        } as unknown) as DataProvider;
        const { queryAllByText } = renderWithRedux(
            <DataProviderContext.Provider value={dataProvider}>
                <ResourceProvider value={resourceValue}>
                    <EditController {...defaultProps}>
                        {({ record }) => <div>{record && record.title}</div>}
                    </EditController>
                </ResourceProvider>
            </DataProviderContext.Provider>,
            {
                admin: {
                    resources: {
                        posts: {
                            data: { 12: { id: 12, title: 'hello' } },
                            props: {
                                name: 'posts',
                                hasCreate: true,
                                hasEdit: true,
                                hasList: true,
                                hasShow: true,
                            },
                        },
                    },
                },
            }
        );
        expect(queryAllByText('hello')).toHaveLength(1);
    });

    it('should call the dataProvider.update() function on save', async () => {
        const update = jest
            .fn()
            .mockImplementationOnce((_, { id, data, previousData }) =>
                Promise.resolve({ data: { id, ...previousData, ...data } })
            );
        const dataProvider = ({
            getOne: () => Promise.resolve({ data: { id: 12 } }),
            update,
        } as unknown) as DataProvider;
        let saveCallback;
        renderWithRedux(
            <DataProviderContext.Provider value={dataProvider}>
                <ResourceProvider value={resourceValue}>
                    <EditController {...defaultProps} undoable={false}>
                        {({ save }) => {
                            saveCallback = save;
                            return null;
                        }}
                    </EditController>
                </ResourceProvider>
            </DataProviderContext.Provider>,
            initialState
        );
        await act(async () => saveCallback({ foo: 'bar' }));
        expect(update).toHaveBeenCalledWith('posts', {
            id: 12,
            data: { foo: 'bar' },
            previousData: undefined,
        });
    });

    it('should return an undoable save callback by default', async () => {
        const dataProvider = ({
            getOne: () => Promise.resolve({ data: { id: 12 } }),
            update: (_, { id, data, previousData }) =>
                Promise.resolve({ data: { id, ...previousData, ...data } }),
        } as unknown) as DataProvider;
        let saveCallback;
        const { dispatch } = renderWithRedux(
            <DataProviderContext.Provider value={dataProvider}>
                <ResourceProvider value={resourceValue}>
                    <EditController {...defaultProps}>
                        {({ save }) => {
                            saveCallback = save;
                            return null;
                        }}
                    </EditController>
                </ResourceProvider>
            </DataProviderContext.Provider>,
            initialState
        );
        await act(async () => saveCallback({ foo: 'bar' }));
        const call = dispatch.mock.calls.find(
            params => params[0].type === 'RA/CRUD_UPDATE_OPTIMISTIC'
        );
        expect(call).not.toBeUndefined();
        const crudUpdateAction = call[0];
        expect(crudUpdateAction.payload).toEqual({
            id: 12,
            data: { foo: 'bar' },
            previousData: undefined,
        });
        expect(crudUpdateAction.meta.resource).toEqual('posts');
    });

    it('should return a save callback when undoable is false', async () => {
        let saveCallback;
        const dataProvider = ({
            getOne: () => Promise.resolve({ data: { id: 12 } }),
            update: (_, { id, data, previousData }) =>
                Promise.resolve({ data: { id, ...previousData, ...data } }),
        } as unknown) as DataProvider;
        const { dispatch } = renderWithRedux(
            <DataProviderContext.Provider value={dataProvider}>
                <ResourceProvider value={resourceValue}>
                    <EditController {...defaultProps} undoable={false}>
                        {({ save }) => {
                            saveCallback = save;
                            return null;
                        }}
                    </EditController>
                </ResourceProvider>
            </DataProviderContext.Provider>,
            initialState
        );
        await act(async () => saveCallback({ foo: 'bar' }));
        const call = dispatch.mock.calls.find(
            params => params[0].type === 'RA/CRUD_UPDATE_OPTIMISTIC'
        );
        expect(call).toBeUndefined();
        const call2 = dispatch.mock.calls.find(
            params => params[0].type === 'RA/CRUD_UPDATE'
        );
        expect(call2).not.toBeUndefined();
        const crudUpdateAction = call2[0];
        expect(crudUpdateAction.payload).toEqual({
            id: 12,
            data: { foo: 'bar' },
            previousData: undefined,
        });
        expect(crudUpdateAction.meta.resource).toEqual('posts');
        const notify = dispatch.mock.calls.find(
            params => params[0].type === 'RA/SHOW_NOTIFICATION'
        );
        expect(notify).not.toBeUndefined();
    });

    it('should allow onSuccess to override the default success side effects', async () => {
        let saveCallback;
        const dataProvider = ({
            getOne: () => Promise.resolve({ data: { id: 12 } }),
            update: (_, { id, data, previousData }) =>
                Promise.resolve({ data: { id, ...previousData, ...data } }),
        } as unknown) as DataProvider;
        const onSuccess = jest.fn();
        const { dispatch } = renderWithRedux(
            <DataProviderContext.Provider value={dataProvider}>
                <ResourceProvider value={resourceValue}>
                    <EditController
                        {...defaultProps}
                        undoable={false}
                        onSuccess={onSuccess}
                    >
                        {({ save }) => {
                            saveCallback = save;
                            return null;
                        }}
                    </EditController>
                </ResourceProvider>
            </DataProviderContext.Provider>,
            initialState
        );
        await act(async () => saveCallback({ foo: 'bar' }));
        expect(onSuccess).toHaveBeenCalled();
        const notify = dispatch.mock.calls.find(
            params => params[0].type === 'RA/SHOW_NOTIFICATION'
        );
        expect(notify).toBeUndefined();
    });

    it('should allow the save onSuccess option to override the success side effects override', async () => {
        let saveCallback;
        const dataProvider = ({
            getOne: () => Promise.resolve({ data: { id: 12 } }),
            update: (_, { id, data, previousData }) =>
                Promise.resolve({ data: { id, ...previousData, ...data } }),
        } as unknown) as DataProvider;
        const onSuccess = jest.fn();
        const onSuccessSave = jest.fn();
        const { dispatch } = renderWithRedux(
            <DataProviderContext.Provider value={dataProvider}>
                <ResourceProvider value={resourceValue}>
                    <EditController
                        {...defaultProps}
                        undoable={false}
                        onSuccess={onSuccess}
                    >
                        {({ save }) => {
                            saveCallback = save;
                            return null;
                        }}
                    </EditController>
                </ResourceProvider>
            </DataProviderContext.Provider>,
            initialState
        );
        await act(async () =>
            saveCallback({ foo: 'bar' }, undefined, {
                onSuccess: onSuccessSave,
            })
        );
        expect(onSuccess).not.toHaveBeenCalled();
        expect(onSuccessSave).toHaveBeenCalled();
        const notify = dispatch.mock.calls.find(
            params => params[0].type === 'RA/SHOW_NOTIFICATION'
        );
        expect(notify).toBeUndefined();
    });

    it('should allow onFailure to override the default failure side effects', async () => {
        jest.spyOn(console, 'error').mockImplementationOnce(() => {});
        let saveCallback;
        const dataProvider = ({
            getOne: () => Promise.resolve({ data: { id: 12 } }),
            update: () => Promise.reject({ message: 'not good' }),
        } as unknown) as DataProvider;
        const onFailure = jest.fn();
        const { dispatch } = renderWithRedux(
            <DataProviderContext.Provider value={dataProvider}>
                <ResourceProvider value={resourceValue}>
                    <EditController
                        {...defaultProps}
                        undoable={false}
                        onFailure={onFailure}
                    >
                        {({ save }) => {
                            saveCallback = save;
                            return null;
                        }}
                    </EditController>
                </ResourceProvider>
            </DataProviderContext.Provider>,
            initialState
        );
        await act(async () => saveCallback({ foo: 'bar' }));
        expect(onFailure).toHaveBeenCalled();
        const notify = dispatch.mock.calls.find(
            params => params[0].type === 'RA/SHOW_NOTIFICATION'
        );
        expect(notify).toBeUndefined();
    });

    it('should allow the save onFailure option to override the failure side effects override', async () => {
        jest.spyOn(console, 'error').mockImplementationOnce(() => {});
        let saveCallback;
        const dataProvider = ({
            getOne: () => Promise.resolve({ data: { id: 12 } }),
            update: () => Promise.reject({ message: 'not good' }),
        } as unknown) as DataProvider;
        const onFailure = jest.fn();
        const onFailureSave = jest.fn();
        const { dispatch } = renderWithRedux(
            <DataProviderContext.Provider value={dataProvider}>
                <ResourceProvider value={resourceValue}>
                    <EditController
                        {...defaultProps}
                        undoable={false}
                        onFailure={onFailure}
                    >
                        {({ save }) => {
                            saveCallback = save;
                            return null;
                        }}
                    </EditController>
                </ResourceProvider>
            </DataProviderContext.Provider>,
            initialState
        );
        await act(async () =>
            saveCallback({ foo: 'bar' }, undefined, {
                onFailure: onFailureSave,
            })
        );
        expect(onFailure).not.toHaveBeenCalled();
        expect(onFailureSave).toHaveBeenCalled();
        const notify = dispatch.mock.calls.find(
            params => params[0].type === 'RA/SHOW_NOTIFICATION'
        );
        expect(notify).toBeUndefined();
    });

    it('should allow transform to transform the data before save', async () => {
        let saveCallback;
        const update = jest
            .fn()
            .mockImplementationOnce((_, { id, data }) =>
                Promise.resolve({ data: { id, ...data } })
            );
        const dataProvider = ({
            getOne: () => Promise.resolve({ data: { id: 12 } }),
            update,
        } as unknown) as DataProvider;
        const transform = jest.fn().mockImplementationOnce(data => ({
            ...data,
            transformed: true,
        }));
        renderWithRedux(
            <DataProviderContext.Provider value={dataProvider}>
                <ResourceProvider value={resourceValue}>
                    <EditController
                        {...defaultProps}
                        undoable={false}
                        transform={transform}
                    >
                        {({ save }) => {
                            saveCallback = save;
                            return null;
                        }}
                    </EditController>
                </ResourceProvider>
            </DataProviderContext.Provider>,
            initialState
        );
        await act(async () => saveCallback({ foo: 'bar' }));
        expect(transform).toHaveBeenCalledWith({
            foo: 'bar',
        });
        expect(update).toHaveBeenCalledWith('posts', {
            id: 12,
            data: { foo: 'bar', transformed: true },
            previousData: undefined,
        });
    });

    it('should the save transform option to override the transform side effect', async () => {
        let saveCallback;
        const update = jest
            .fn()
            .mockImplementationOnce((_, { id, data }) =>
                Promise.resolve({ data: { id, ...data } })
            );
        const dataProvider = ({
            getOne: () => Promise.resolve({ data: { id: 12 } }),
            update,
        } as unknown) as DataProvider;
        const transform = jest.fn();
        const transformSave = jest.fn().mockImplementationOnce(data => ({
            ...data,
            transformed: true,
        }));
        renderWithRedux(
            <DataProviderContext.Provider value={dataProvider}>
                <ResourceProvider value={resourceValue}>
                    <EditController
                        {...defaultProps}
                        undoable={false}
                        transform={transform}
                    >
                        {({ save }) => {
                            saveCallback = save;
                            return null;
                        }}
                    </EditController>
                </ResourceProvider>
            </DataProviderContext.Provider>,
            initialState
        );
        await act(async () =>
            saveCallback({ foo: 'bar' }, undefined, {
                transform: transformSave,
            })
        );
        expect(transform).not.toHaveBeenCalled();
        expect(transformSave).toHaveBeenCalledWith({
            foo: 'bar',
        });
        expect(update).toHaveBeenCalledWith('posts', {
            id: 12,
            data: { foo: 'bar', transformed: true },
            previousData: undefined,
        });
    });
});
